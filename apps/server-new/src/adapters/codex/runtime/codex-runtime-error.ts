export class CodexProcessStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexProcessStartError';
  }
}

export class CodexProcessExitError extends Error {
  constructor(
    public readonly reason: string,
    public readonly stderr: string,
  ) {
    super(stderr ? `Codex process exited with ${reason}: ${stderr}` : `Codex process exited with ${reason}`);
    this.name = 'CodexProcessExitError';
  }
}

export class CodexTransportClosedError extends Error {
  constructor() {
    super('Codex transport is closed');
    this.name = 'CodexTransportClosedError';
  }
}

export class CodexRequestTimeoutError extends Error {
  constructor(
    public readonly method: string,
    public readonly waitedMs: number,
  ) {
    super(`Codex request timed out: ${method} after ${waitedMs}ms`);
    this.name = 'CodexRequestTimeoutError';
  }
}

export class CodexProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexProtocolError';
  }
}

export class CodexRpcError extends Error {
  constructor(
    public readonly method: string,
    public readonly code: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'CodexRpcError';
  }
}

export class CodexBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexBootstrapError';
  }
}
