export class LocalizerError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'LocalizerError';
  }
}

export class ModelLoadError extends LocalizerError {
  constructor(message: string) {
    super(message, 'MODEL_LOAD_ERROR');
    this.name = 'ModelLoadError';
  }
}

export class UnsupportedBrowserError extends LocalizerError {
  constructor(message: string) {
    super(message, 'UNSUPPORTED_BROWSER');
    this.name = 'UnsupportedBrowserError';
  }
}

export class OutOfMemoryError extends LocalizerError {
  constructor(message: string) {
    super(message, 'OUT_OF_MEMORY');
    this.name = 'OutOfMemoryError';
  }
}

export class WorkerError extends LocalizerError {
  constructor(message: string) {
    super(message, 'WORKER_ERROR');
    this.name = 'WorkerError';
  }
}
