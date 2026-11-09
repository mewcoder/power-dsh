// Queue user operations without making plugin unload wait on native reload locks.
export class OperationQueue {
  closed: boolean;
  tail: Promise<unknown>;
  constructor() {
    this.closed = false;
    this.tail = Promise.resolve();
  }

  ensureActive() {
    if (this.closed) {
      const error = Object.assign(new Error('Mod has been unloaded. Retry after enabling it again.'), { code: 'mod/unloaded' });
      throw error;
    }
  }

  run<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    const task = this.tail.then(() => {
      this.ensureActive();
      return operation();
    });
    this.tail = task.catch(() => {});
    return task;
  }

  close() { this.closed = true; }
}
