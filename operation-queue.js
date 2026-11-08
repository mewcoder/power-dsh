// Queue user operations without making plugin unload wait on native reload locks.
export class OperationQueue {
  constructor() {
    this.closed = false;
    this.tail = Promise.resolve();
  }

  ensureActive() {
    if (this.closed) {
      const error = new Error('Mod has been unloaded. Retry after enabling it again.');
      error.code = 'mod/unloaded';
      throw error;
    }
  }

  run(operation) {
    const task = this.tail.then(() => {
      this.ensureActive();
      return operation();
    });
    this.tail = task.catch(() => {});
    return task;
  }

  close() { this.closed = true; }
}
