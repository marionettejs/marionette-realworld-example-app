// Post-hoc operator observation: not part of frozen acceptance or a model retry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const workspace = resolve(process.argv[2] ?? '.');
const sourcePath = join(workspace, 'solution.mjs');
const source = await readFile(sourcePath);
const { createReviewSession } = await import(sourcePath);
const loads = new Map();
const validations = new Map();
const data = { label: 'previous', draft: '', status: 'offline' };
const tick = () => new Promise(resolve => setImmediate(resolve));
const session = createReviewSession({
  state: { get: k => data[k], set: (k,v) => { data[k] = v; }, dispose() { assert.fail('borrowed state disposed'); } },
  load(id, context) { const g = { ...Promise.withResolvers(), context }; loads.set(id,g); return g.promise; },
  validate(value, context) { const g = { ...Promise.withResolvers(), context }; validations.set(value,g); return g.promise; },
  subscribe() { return () => {}; }, schedule() { return () => {}; }, onPulse() {},
});
const waiting = [];
let observed;
try {
  const initial = session.app.start({ id: 'initial' }); waiting.push(initial);
  loads.get('initial').resolve('initial'); await tick();
  validations.get('initial').resolve(); assert.equal(await initial, true);
  const old = session.app.restart({ id: 'old' }); waiting.push(old);
  loads.get('old').resolve('old'); await tick();
  assert.ok(validations.has('old'));
  const latest = session.app.restart({ id: 'latest' }); waiting.push(latest);
  assert.ok(loads.has('latest'));
  assert.equal(await old, false);
  assert.equal(session.app.isRunning(), true, 'active restart retains running state');
  validations.get('old').resolve(); await tick(); await tick();
  const refresh = session.refresh('during-latest'); waiting.push(refresh);
  await tick();
  observed = { latestRestartStillPending: true, applicationStillRunning: session.app.isRunning(),
    refreshStartedLoad: loads.has('during-latest'), latestLoadSignalAborted: loads.get('latest').context.signal.aborted,
    expectedRefreshStartedLoad: false, expectedLatestLoadSignalAborted: false };
} finally {
  session.app.destroy();
  for (const gate of loads.values()) gate.resolve('cleanup');
  for (const gate of validations.values()) gate.resolve();
  await tick();
  for (const gate of validations.values()) gate.resolve();
  await Promise.allSettled(waiting);
}
const report = { kind: 'post-hoc-operator-nonmodel-supported-workflow-probe', scored: false,
  checkedUTC: new Date().toISOString(), candidateSource: 'solution.mjs',
  candidateSourceSha256: createHash('sha256').update(source).digest('hex'),
  originalFrozenAcceptanceUnchanged: true, frozenAcceptanceResult: '11/11 passed',
  sequence: 'Successful start; retained restart A awaits validation; retained restart B awaits load and supersedes A; A validation settles late; invoke refresh while B remains pending.',
  observed, publicRequirement: 'While starting, refresh returns false without loading.',
  diagnosis: 'Canceled prepareStart request finally unconditionally sets shared isStarting=false, clearing the newer pending restart gate. Refresh starts a new load and aborts the newer pending load.',
  candidateEdited: false, additionalModelInvocations: 0, feedbackSentToAgent: false,
  limitation: 'A post-hoc deterministic observation, not an originally prespecified acceptance case, a new scoring gate, or a framework defect.' };
console.log(JSON.stringify(report,null,2));
assert.equal(observed.refreshStartedLoad, false, 'refresh must remain gated during the newest pending retained restart');
