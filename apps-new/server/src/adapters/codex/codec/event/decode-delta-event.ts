import { readString } from '../reader/index.js';
import type { RuntimeEvent, RuntimeItemDeltaKind } from '../../../../ports/index.js';
import { readCodexTextLike } from '../reader/index.js';
import type { DecodeCodexNotificationInput } from './codex-notification-input.js';

interface DeltaMapping {
  readonly deltaKind: RuntimeItemDeltaKind;
  readonly textField: string | null;
}

const deltaMappings: Record<string, DeltaMapping> = {
  'item/agentMessage/delta': { deltaKind: 'agent-message', textField: 'delta' },
  'item/plan/delta': { deltaKind: 'plan', textField: 'delta' },
  'item/reasoning/summaryTextDelta': { deltaKind: 'reasoning-summary-text', textField: 'delta' },
  'item/reasoning/summaryPartAdded': { deltaKind: 'reasoning-summary-part', textField: null },
  'item/reasoning/textDelta': { deltaKind: 'reasoning-text', textField: 'delta' },
  'item/commandExecution/outputDelta': { deltaKind: 'command-output', textField: 'delta' },
  'item/commandExecution/terminalInteraction': { deltaKind: 'terminal-interaction', textField: 'stdin' },
  'item/fileChange/outputDelta': { deltaKind: 'file-change-output', textField: 'delta' },
  'item/fileChange/patchUpdated': { deltaKind: 'file-change-patch', textField: null },
  'item/mcpToolCall/progress': { deltaKind: 'mcp-tool-progress', textField: 'message' },
};

export function decodeDeltaEvent(input: DecodeCodexNotificationInput): RuntimeEvent | null {
  const mapping = deltaMappings[input.method];

  if (!mapping) {
    return null;
  }

  return {
    kind: 'runtime-item-delta',
    threadId: readString(input.params.threadId, `${input.method} threadId`),
    turnId: readString(input.params.turnId, `${input.method} turnId`),
    itemId: readString(input.params.itemId, `${input.method} itemId`),
    deltaKind: mapping.deltaKind,
    text: mapping.textField ? readCodexTextLike(input.params[mapping.textField]) : null,
    data: input.params,
  };
}
