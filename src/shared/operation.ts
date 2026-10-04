// Explicit active-run operations. Preparation itself uses Marionette's signal.
export class Operation {
  private controller?: AbortController;
  async run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    commit: (result: T) => void,
    fail: (error: unknown) => void,
  ): Promise<void> {
    if (this.controller) return;
    const controller = (this.controller = new AbortController());
    try {
      const value = await work(controller.signal);
      if (!controller.signal.aborted) commit(value);
    } catch (error) {
      if (!controller.signal.aborted) fail(error);
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }
  cancel() {
    this.controller?.abort();
    this.controller = undefined;
  }
}
