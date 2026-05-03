export interface CodexRuntimeLogger {
  warn(message: string): void;
}

export function createStderrCodexRuntimeLogger(): CodexRuntimeLogger {
  return {
    warn(message: string) {
      process.stderr.write(`${message}\n`);
    },
  };
}

export function formatUnknownCodexPayload(input: { readonly method: string; readonly params: unknown }): string {
  return `[server-new codex] ignored unknown Codex message: ${safeStringify(input)}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
