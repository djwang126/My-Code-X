import type { RuntimeCommand, RuntimeEvent, RuntimeResult } from '../../ports/index.js';

export type CodexPayload = unknown;

export function toRuntimeCommand(payload: CodexPayload): RuntimeCommand {
  return payload;
}

export function toRuntimeEvent(payload: CodexPayload): RuntimeEvent {
  return payload;
}

export function toCodexResult(result: RuntimeResult): CodexPayload {
  return result;
}