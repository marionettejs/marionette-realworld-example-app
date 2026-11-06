import assert from 'node:assert/strict';
import { createReviewSession } from './solution.mjs';

function createMockState(initial = {}) {
  const data = new Map(Object.entries(initial));
  let disposed = false;
  return {
    get(key) { return data.get(key); },
    set(key, value) { data.set(key, value); return value; },
    dispose() { disposed = true; },
    isDisposed() { return disposed; },
    data
  };
}

async function runTests() {
  console.log('--- TEST 1: Normal startup, editing, refresh, and stop ---');
  {
    const state = createMockState();
    let loadCalled = 0;
    let validateCalled = 0;
    let subscribed = 0;
    let unsubscribed = 0;
    let scheduled = 0;
    let unscheduled = 0;

    const session = createReviewSession({
      state,
      load: async (id, { signal }) => {
        loadCalled++;
        return `val-${id}`;
      },
      validate: async (val, { signal }) => {
        validateCalled++;
        return true;
      },
      subscribe: (cb) => {
        subscribed++;
        cb('online');
        return () => { unsubscribed++; };
      },
      schedule: (pulse) => {
        scheduled++;
        return () => { unscheduled++; };
      },
      onPulse: () => {}
    });

    assert.equal(session.app.getState(), state, 'app.getState() must return borrowed state');
    assert.equal(session.app.isRunning(), false);

    // Refresh before start returns false without loading
    const earlyRefresh = await session.refresh('1');
    assert.equal(earlyRefresh, false, 'refresh while stopped returns false');
    assert.equal(loadCalled, 0, 'load not called during early refresh');

    // Edit before start
    session.edit('my-draft');
    assert.equal(state.get('draft'), 'my-draft');

    // Start
    const started = await session.app.start({ id: 'rec-1' });
    assert.equal(started, true);
    assert.equal(loadCalled, 1);
    assert.equal(validateCalled, 1);
    assert.equal(state.get('label'), 'val-rec-1');
    assert.equal(state.get('status'), 'online');
    assert.equal(state.get('draft'), 'my-draft', 'draft preserved through startup');
    assert.equal(subscribed, 1);
    assert.equal(scheduled, 1);
    assert.equal(session.app.isRunning(), true);

    // Refresh while running
    const refreshed = await session.refresh('rec-2');
    assert.equal(refreshed, true);
    assert.equal(loadCalled, 2);
    assert.equal(validateCalled, 2);
    assert.equal(state.get('label'), 'val-rec-2');
    assert.equal(state.get('draft'), 'my-draft', 'draft preserved through refresh');

    // Stop
    const stopped = session.app.stop();
    assert.equal(stopped, true);
    assert.equal(session.app.isRunning(), false);
    assert.equal(unsubscribed, 1, 'subscription released on stop');
    assert.equal(unscheduled, 1, 'timer released on stop');
    assert.equal(state.isDisposed(), false, 'state not disposed on stop');
    assert.equal(state.get('draft'), 'my-draft', 'draft preserved through stop');

    // Refresh while stopped
    const stoppedRefresh = await session.refresh('rec-3');
    assert.equal(stoppedRefresh, false, 'refresh while stopped returns false');
    assert.equal(loadCalled, 2, 'no new load called while stopped');
  }

  console.log('--- TEST 2: Switching sessions during validation (Issue 1) ---');
  {
    const state = createMockState();
    let resolveSlowValidate;
    let slowValidateCalled = false;

    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async (val, { signal }) => {
        if (val === 'val-slow') {
          slowValidateCalled = true;
          return new Promise(r => { resolveSlowValidate = r; });
        }
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'initial' });
    assert.equal(state.get('label'), 'val-initial');

    // Start slow refresh
    const pSlow = session.refresh('slow');
    await new Promise(r => setTimeout(r, 10));
    assert.equal(slowValidateCalled, true, 'slow validate reached');

    // Start fast refresh while slow is validating
    const pFast = session.refresh('fast');
    const fastResult = await pFast;
    assert.equal(fastResult, true, 'fast refresh succeeded');
    assert.equal(state.get('label'), 'val-fast', 'fast label committed');

    // Now slow validate completes late
    resolveSlowValidate(true);
    const slowResult = await pSlow;
    assert.equal(slowResult, false, 'obsolete request resolves false');
    assert.equal(state.get('label'), 'val-fast', 'late validation must not overwrite newer label');
  }

  console.log('--- TEST 3: Destruction does not dispose borrowed state (Issue 2) ---');
  {
    const state = createMockState();
    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async () => true,
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'rec-1' });
    assert.equal(state.isDisposed(), false);

    session.app.destroy();
    assert.equal(state.isDisposed(), false, 'state must NEVER be disposed');
    assert.equal(session.app.getState(), state, 'getState returns state even after destruction');

    // Refresh after destroy returns false without loading
    const destroyRefresh = await session.refresh('rec-2');
    assert.equal(destroyRefresh, false, 'refresh after destroy returns false');
  }

  console.log('--- TEST 4: Late load cancellation ---');
  {
    const state = createMockState();
    let resolveSlowLoad;
    let validateCalls = [];

    const session = createReviewSession({
      state,
      load: async (id) => {
        if (id === 'slow') {
          return new Promise(r => { resolveSlowLoad = r; });
        }
        return `val-${id}`;
      },
      validate: async (val) => {
        validateCalls.push(val);
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });

    const pSlow = session.refresh('slow');
    await new Promise(r => setTimeout(r, 10));

    const pFast = session.refresh('fast');
    const fastRes = await pFast;
    assert.equal(fastRes, true);
    assert.equal(state.get('label'), 'val-fast');

    // Resolve slow load late
    resolveSlowLoad('val-slow');
    const slowRes = await pSlow;
    assert.equal(slowRes, false);
    assert.deepEqual(validateCalls, ['val-init', 'val-fast'], 'canceled load must not trigger validate');
    assert.equal(state.get('label'), 'val-fast');
  }

  console.log('--- TEST 5: Stale error suppression ---');
  {
    const state = createMockState();
    let rejectSlowValidate;

    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async (val) => {
        if (val === 'val-slow') {
          return new Promise((_, rej) => { rejectSlowValidate = rej; });
        }
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });

    const pSlow = session.refresh('slow');
    await new Promise(r => setTimeout(r, 10));

    const pFast = session.refresh('fast');
    await pFast;

    // Slow validate rejects
    rejectSlowValidate(new Error('slow validation error'));
    const slowRes = await pSlow;
    assert.equal(slowRes, false, 'stale error must resolve false and not throw');
    assert.equal(state.get('label'), 'val-fast');
  }

  console.log('--- TEST 6: Current failure rejects and preserves previous label ---');
  {
    const state = createMockState();
    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async (val) => {
        if (val === 'val-bad') throw new Error('validation failed');
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'good' });
    session.edit('kept-draft');
    assert.equal(state.get('label'), 'val-good');

    await assert.rejects(
      async () => { await session.refresh('bad'); },
      /validation failed/,
      'current failure must reject'
    );
    assert.equal(state.get('label'), 'val-good', 'label preserved on failure');
    assert.equal(state.get('draft'), 'kept-draft', 'draft preserved on failure');
  }

  console.log('--- TEST 7: Startup failure acquires no resources ---');
  {
    const state = createMockState();
    let subscribed = false;
    let scheduled = false;

    const session = createReviewSession({
      state,
      load: async () => 'val',
      validate: async () => { throw new Error('start fail'); },
      subscribe: () => { subscribed = true; return () => {}; },
      schedule: () => { scheduled = true; return () => {}; },
      onPulse: () => {}
    });

    await assert.rejects(
      async () => { await session.app.start({ id: 'any' }); },
      /start fail/
    );
    assert.equal(subscribed, false, 'no subscribe on start failure');
    assert.equal(scheduled, false, 'no schedule on start failure');
    assert.equal(session.app.isRunning(), false);
  }

  console.log('--- TEST 8: Restart preserves registrations count and draft ---');
  {
    const state = createMockState();
    let activeSubscribers = 0;
    let activeTimers = 0;

    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async (val) => {
        if (val === 'val-fail') throw new Error('restart fail');
        return true;
      },
      subscribe: () => {
        activeSubscribers++;
        return () => { activeSubscribers--; };
      },
      schedule: () => {
        activeTimers++;
        return () => { activeTimers--; };
      },
      onPulse: () => {}
    });

    await session.app.start({ id: 'rec-1' });
    session.edit('draft-123');
    assert.equal(activeSubscribers, 1);
    assert.equal(activeTimers, 1);
    assert.equal(state.get('label'), 'val-rec-1');

    // Successful restart
    const restarted = await session.app.restart({ id: 'rec-2' });
    assert.equal(restarted, true);
    assert.equal(activeSubscribers, 1, 'exactly 1 active subscriber after restart');
    assert.equal(activeTimers, 1, 'exactly 1 active timer after restart');
    assert.equal(state.get('label'), 'val-rec-2');
    assert.equal(state.get('draft'), 'draft-123', 'draft preserved after restart');

    // Failed restart
    await assert.rejects(
      async () => { await session.app.restart({ id: 'fail' }); },
      /restart fail/
    );
    assert.equal(activeSubscribers, 1, 'registrations preserved after failed restart');
    assert.equal(activeTimers, 1, 'timers preserved after failed restart');
    assert.equal(state.get('label'), 'val-rec-2', 'previous label preserved after failed restart');
    assert.equal(state.get('draft'), 'draft-123', 'draft preserved after failed restart');
  }

  console.log('--- TEST 9: Synchronous stop and destroy cancellation ---');
  {
    const state = createMockState();
    let unsubs = 0;
    let untimers = 0;

    const session = createReviewSession({
      state,
      load: async () => {
        await new Promise(r => setTimeout(r, 50));
        return 'late-val';
      },
      validate: async () => true,
      subscribe: () => () => { unsubs++; },
      schedule: () => () => { untimers++; },
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });
    assert.equal(state.get('label'), 'late-val');

    state.set('label', 'steady');
    const pRefresh = session.refresh('slow');

    // Stop synchronously
    const stopRes = session.app.stop();
    assert.equal(stopRes, true, 'stop returns true synchronously');
    assert.equal(unsubs, 1, 'unsubscribed before stop returned');
    assert.equal(untimers, 1, 'untimer before stop returned');

    const refRes = await pRefresh;
    assert.equal(refRes, false, 'in-flight refresh resolves false');
    assert.equal(state.get('label'), 'steady', 'late value not committed after stop');
  }

  console.log('--- TEST 10: Refresh while starting returns false without loading ---');
  {
    const state = createMockState();
    let resolveLoad;
    let refreshLoadCalled = false;

    const session = createReviewSession({
      state,
      load: async (id) => {
        if (id === 'refresh-id') refreshLoadCalled = true;
        return new Promise(r => { resolveLoad = r; });
      },
      validate: async () => true,
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    const startP = session.app.start({ id: 'starting-id' });
    // while starting:
    const refRes = await session.refresh('refresh-id');
    assert.equal(refRes, false, 'refresh while starting returns false');
    assert.equal(refreshLoadCalled, false, 'refresh while starting does not call load');

    resolveLoad('start-val');
    await startP;
    assert.equal(session.app.isRunning(), true);
  }

  console.log('--- TEST 11: Obsolete request settles only when provider settles ---');
  {
    const state = createMockState();
    let resolveProvider;
    let providerSettled = false;

    const session = createReviewSession({
      state,
      load: async (id) => {
        if (id === 'slow') {
          return new Promise(r => {
            resolveProvider = () => {
              providerSettled = true;
              r('val-slow');
            };
          });
        }
        return `val-${id}`;
      },
      validate: async () => true,
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });

    let pSlowSettled = false;
    const pSlow = session.refresh('slow');
    pSlow.then(() => { pSlowSettled = true; });

    await new Promise(r => setTimeout(r, 10));

    // Supersede with fast
    const pFast = session.refresh('fast');
    await pFast;

    // Fast finished, but slow provider hasn't settled yet
    assert.equal(providerSettled, false);
    assert.equal(pSlowSettled, false, 'pSlow must not settle before provider settles');

    // Now let slow provider settle
    resolveProvider();
    const slowRes = await pSlow;
    assert.equal(slowRes, false);
    assert.equal(pSlowSettled, true);
    assert.equal(state.get('label'), 'val-fast');
  }

  console.log('--- TEST 12: Cancellation during startup validation followed by newer start ---');
  {
    const state = createMockState();
    let resolveSlowVal;

    const session = createReviewSession({
      state,
      load: async (id) => `val-${id}`,
      validate: async (val) => {
        if (val === 'val-slow') {
          return new Promise(r => { resolveSlowVal = r; });
        }
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    // Start slow
    const pStartSlow = session.app.start({ id: 'slow' });
    await new Promise(r => setTimeout(r, 10));

    // While slow is validating, restart with fast
    const pStartFast = session.app.restart({ id: 'fast' });
    const fastRes = await pStartFast;
    assert.equal(fastRes, true);
    assert.equal(state.get('label'), 'val-fast');

    // Late validation of slow finishes
    resolveSlowVal(true);
    await pStartSlow;
    assert.equal(state.get('label'), 'val-fast', 'late validation cannot commit after newer successful start');
  }

  console.log('--- TEST 13: Multiple rapid refreshes ---');
  {
    const state = createMockState();
    const session = createReviewSession({
      state,
      load: async (id) => {
        await new Promise(r => setTimeout(r, 10));
        return `val-${id}`;
      },
      validate: async (val) => {
        await new Promise(r => setTimeout(r, 10));
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });

    const [r1, r2, r3] = await Promise.all([
      session.refresh('1'),
      session.refresh('2'),
      session.refresh('3')
    ]);

    assert.equal(r1, false);
    assert.equal(r2, false);
    assert.equal(r3, true);
    assert.equal(state.get('label'), 'val-3');
  }

  console.log('--- TEST 14: Providers ignoring abort ---');
  {
    const state = createMockState();
    let abortObserved = false;

    const session = createReviewSession({
      state,
      load: async (id, { signal }) => {
        await new Promise(r => setTimeout(r, 20));
        if (signal.aborted) abortObserved = true;
        // Provider completely ignores abort and resolves
        return `val-${id}`;
      },
      validate: async (val, { signal }) => {
        await new Promise(r => setTimeout(r, 20));
        if (signal.aborted) abortObserved = true;
        // Provider completely ignores abort and resolves
        return true;
      },
      subscribe: () => () => {},
      schedule: () => () => {},
      onPulse: () => {}
    });

    await session.app.start({ id: 'init' });

    const pSlow = session.refresh('slow');
    await new Promise(r => setTimeout(r, 5));
    const pFast = session.refresh('fast');

    const [slowRes, fastRes] = await Promise.all([pSlow, pFast]);
    assert.equal(slowRes, false);
    assert.equal(fastRes, true);
    assert.equal(abortObserved, true);
    assert.equal(state.get('label'), 'val-fast');
  }

  console.log('--- TEST 15: Heartbeat schedule with onPulse ---');
  {
    const state = createMockState();
    let pulseHandler;
    let pulsesFired = 0;

    const session = createReviewSession({
      state,
      load: async () => 'ok',
      validate: async () => true,
      subscribe: (cb) => {
        cb('active');
        return () => {};
      },
      schedule: (onPulse) => {
        pulseHandler = onPulse;
        return () => { pulseHandler = undefined; };
      },
      onPulse: () => {
        pulsesFired++;
      }
    });

    await session.app.start({ id: '1' });
    assert.equal(typeof pulseHandler, 'function');
    pulseHandler();
    pulseHandler();
    assert.equal(pulsesFired, 2);

    session.app.stop();
    assert.equal(pulseHandler, undefined);
  }

  console.log('ALL 15 TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
