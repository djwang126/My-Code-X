import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import type {
  RespondToRuntimeRequestCommand,
  RuntimeCommand,
  RuntimeContentItem,
  RuntimeSandboxMode,
  RuntimeSettings,
} from '../../../ports/index.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type { CodexRequest } from './codex-request.js';

type CodexRequestRuntimeCommand = Exclude<RuntimeCommand, RespondToRuntimeRequestCommand>;

export function mapRuntimeCommandToCodexRequest(command: CodexRequestRuntimeCommand, input: MapRuntimeCommandInput): CodexRequest {
  switch (command.kind) {
    case 'start-thread':
      return {
        method: 'thread/start',
        params: cleanJsonObject({
          cwd: command.workspace,
          ...mapRuntimeSettingsToThreadParams(command.runtimeSettings),
          baseInstructions: command.baseInstructions,
          dynamicTools: input.dynamicTools,
          persistExtendedHistory: true,
        }),
      };

    case 'resume-thread':
      return {
        method: 'thread/resume',
        params: cleanJsonObject({
          threadId: command.threadId,
          cwd: command.workspace,
          ...mapRuntimeSettingsToThreadParams(command.runtimeSettings),
          baseInstructions: command.baseInstructions,
          persistExtendedHistory: true,
        }),
      };

    case 'list-threads':
      return {
        method: 'thread/list',
        params: cleanJsonObject({
          cwd: command.workspace,
          limit: command.limit,
          archived: command.archived,
        }),
      };

    case 'start-turn':
      return {
        method: 'turn/start',
        params: cleanJsonObject({
          threadId: command.threadId,
          input: mapRuntimeContent(command.content, command.message),
          ...mapRuntimeSettingsToTurnParams(command.runtimeSettings),
        }),
      };

    case 'interrupt-turn':
      return {
        method: 'turn/interrupt',
        params: cleanJsonObject({
          threadId: command.threadId,
          turnId: command.turnId,
        }),
      };
  }
}

export interface MapRuntimeCommandInput {
  readonly dynamicTools: readonly JsonValue[];
}

function mapRuntimeSettingsToThreadParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: settings.model,
    approvalPolicy: settings.approvalPolicy,
    sandbox: settings.sandboxMode,
    config: cleanJsonObject({
      model_reasoning_effort: settings.reasoningEffort,
      prompt_override: settings.promptOverride,
    }),
  });
}

function mapRuntimeSettingsToTurnParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: settings.model,
    effort: settings.reasoningEffort,
    approvalPolicy: settings.approvalPolicy,
    sandboxPolicy: mapSandboxPolicy(settings.sandboxMode),
  });
}

function mapSandboxPolicy(sandboxMode: RuntimeSandboxMode | null): JsonValue {
  switch (sandboxMode) {
    case null:
      return null;
    case 'read-only':
      return { type: 'readOnly' };
    case 'workspace-write':
      return { type: 'workspaceWrite' };
    case 'danger-full-access':
      return { type: 'dangerFullAccess' };
  }

  throw new CodexProtocolError(`Unsupported runtime sandbox mode: ${String(sandboxMode)}`);
}

function mapRuntimeContent(content: readonly RuntimeContentItem[], fallbackText: string): readonly JsonValue[] {
  if (!content.length) {
    return [{ type: 'text', text: fallbackText, text_elements: [] }];
  }

  return content.map(item => {
    if (item.kind === 'image') {
      return cleanJsonObject({
        type: 'image',
        path: item.imagePath,
      });
    }

    return cleanJsonObject({
      type: 'text',
      text: item.text || fallbackText,
      text_elements: [],
    });
  });
}

function cleanJsonObject(input: Record<string, JsonValue | undefined>): JsonObject {
  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
