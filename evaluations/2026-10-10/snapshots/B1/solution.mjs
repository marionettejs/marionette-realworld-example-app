import { Application } from 'marionette';

export function createReviewSession({ state, load, validate, subscribe, schedule, onPulse }) {
  let pending;
  let isStarting = false;
  let currentId;
  let releaseSubscription;
  let releaseTimer;

  const cancel = () => {
    if (pending) {
      pending.abort();
      pending = undefined;
    }
  };

  const stopSession = () => {
    isStarting = false;
    cancel();
    releaseSubscription?.();
    releaseSubscription = undefined;
    releaseTimer?.();
    releaseTimer = undefined;
  };

  async function request(id, signal) {
    cancel();
    const controller = new AbortController();
    pending = controller;

    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      controller.abort();
    }

    const isAborted = () => controller.signal.aborted || (app ? app.isDestroyed() : false);

    if (isAborted()) {
      return false;
    }

    const targetId = id !== undefined ? id : currentId;

    try {
      const value = await load(targetId, { signal: controller.signal });
      if (isAborted()) {
        return false;
      }
      await validate(value, { signal: controller.signal });
      if (isAborted()) {
        return false;
      }
      currentId = targetId;
      state.set('label', value);
      return true;
    } catch (error) {
      if (isAborted()) {
        return false;
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      if (pending === controller) {
        pending = undefined;
      }
    }
  }

  const Session = Application.extend({
    state,
    onBeforeStart() {
      isStarting = true;
    },
    prepareStart(options = {}, context = {}) {
      isStarting = true;
      const { id } = options ?? {};
      const { signal } = context ?? {};
      return request(id, signal).finally(() => {
        isStarting = false;
      });
    },
    onStart() {
      isStarting = false;
      releaseSubscription?.();
      releaseSubscription = undefined;
      releaseTimer?.();
      releaseTimer = undefined;
      releaseSubscription = subscribe(status => state.set('status', status));
      releaseTimer = schedule(onPulse);
    },
    onBeforeStop: stopSession,
    onStop: stopSession,
    onBeforeDestroy: stopSession,
    onDestroy: stopSession
  });

  const app = new Session({ state });

  return {
    app,
    refresh(id) {
      if (!app.isRunning() || isStarting || app.isDestroyed()) {
        return Promise.resolve(false);
      }
      return request(id);
    },
    edit(draft) {
      state.set('draft', draft);
    }
  };
}
