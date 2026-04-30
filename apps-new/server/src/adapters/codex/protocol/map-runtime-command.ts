import { CodexProtocolError } from '../runtime/codex-runtime-error.js';
import type {
  RespondToRuntimeRequestCommand,
  RuntimeCommand,
  RuntimeContentItem,
  RuntimeSandboxMode,
  RuntimeSettings,
  RuntimeTurnEnvironment,
} from '../../../ports/index.js';
import type { JsonObject, JsonValue } from '../../../shared/index.js';
import type { CodexRequest } from './codex-request.js';

type CodexRequestRuntimeCommand = Exclude<RuntimeCommand, RespondToRuntimeRequestCommand>;

export function mapRuntimeCommandToCodexRequest(command: CodexRequestRuntimeCommand, input: MapRuntimeCommandInput): CodexRequest {
  switch (command.kind) {
    case 'start-thread':
      assertNoThreadPermissionConflict(command);
      return {
        method: 'thread/start',
        params: cleanJsonObject({
          cwd: command.workspace,
          ...mapRuntimeSettingsToThreadParams(command.runtimeSettings),
          modelProvider: nullToUndefined(command.modelProvider),
          serviceTier: command.serviceTier,
          approvalsReviewer: command.approvalsReviewer,
          permissionProfile: nullToUndefined(command.permissionProfile),
          config: mergeThreadConfig(command.runtimeSettings, command.config),
          serviceName: nullToUndefined(command.serviceName),
          baseInstructions: nullToUndefined(command.baseInstructions),
          developerInstructions: nullToUndefined(command.developerInstructions),
          personality: command.personality,
          ephemeral: nullToUndefined(command.ephemeral),
          sessionStartSource: command.sessionStartSource,
          dynamicTools: input.dynamicTools.length ? input.dynamicTools : undefined,
          experimentalRawEvents: nullToUndefined(command.experimentalRawEvents),
          persistExtendedHistory: true,
        }),
      };

    case 'resume-thread':
      assertNoThreadPermissionConflict(command);
      return {
        method: 'thread/resume',
        params: cleanJsonObject({
          threadId: command.threadId,
          history: nullToUndefined(command.history),
          path: nullToUndefined(command.path),
          cwd: command.workspace,
          ...mapRuntimeSettingsToThreadParams(command.runtimeSettings),
          modelProvider: nullToUndefined(command.modelProvider),
          serviceTier: command.serviceTier,
          approvalsReviewer: command.approvalsReviewer,
          permissionProfile: nullToUndefined(command.permissionProfile),
          config: mergeThreadConfig(command.runtimeSettings, command.config),
          baseInstructions: nullToUndefined(command.baseInstructions),
          developerInstructions: nullToUndefined(command.developerInstructions),
          personality: command.personality,
          persistExtendedHistory: true,
        }),
      };

    case 'fork-thread':
      assertNoThreadPermissionConflict(command);
      return {
        method: 'thread/fork',
        params: cleanJsonObject({
          threadId: command.threadId,
          path: nullToUndefined(command.path),
          cwd: nullToUndefined(command.workspace),
          ...mapRuntimeSettingsToThreadParams(command.runtimeSettings),
          modelProvider: nullToUndefined(command.modelProvider),
          serviceTier: command.serviceTier,
          approvalsReviewer: command.approvalsReviewer,
          permissionProfile: nullToUndefined(command.permissionProfile),
          config: mergeThreadConfig(command.runtimeSettings, command.config),
          baseInstructions: nullToUndefined(command.baseInstructions),
          developerInstructions: nullToUndefined(command.developerInstructions),
          ephemeral: nullToUndefined(command.ephemeral),
          persistExtendedHistory: true,
        }),
      };

    case 'archive-thread':
      return mapThreadIdRequest({ method: 'thread/archive', threadId: command.threadId });

    case 'unarchive-thread':
      return mapThreadIdRequest({ method: 'thread/unarchive', threadId: command.threadId });

    case 'unsubscribe-thread':
      return mapThreadIdRequest({ method: 'thread/unsubscribe', threadId: command.threadId });

    case 'increment-thread-elicitation':
      return mapThreadIdRequest({ method: 'thread/increment_elicitation', threadId: command.threadId });

    case 'decrement-thread-elicitation':
      return mapThreadIdRequest({ method: 'thread/decrement_elicitation', threadId: command.threadId });

    case 'set-thread-name':
      return {
        method: 'thread/name/set',
        params: cleanJsonObject({
          threadId: command.threadId,
          name: command.name,
        }),
      };

    case 'update-thread-metadata':
      return {
        method: 'thread/metadata/update',
        params: cleanJsonObject({
          threadId: command.threadId,
          gitInfo: command.gitInfo,
        }),
      };

    case 'set-thread-memory-mode':
      return {
        method: 'thread/memoryMode/set',
        params: cleanJsonObject({
          threadId: command.threadId,
          mode: command.mode,
        }),
      };

    case 'compact-thread':
      return mapThreadIdRequest({ method: 'thread/compact/start', threadId: command.threadId });

    case 'run-thread-shell-command':
      return {
        method: 'thread/shellCommand',
        params: cleanJsonObject({
          threadId: command.threadId,
          command: command.command,
        }),
      };

    case 'approve-thread-guardian-denied-action':
      return {
        method: 'thread/approveGuardianDeniedAction',
        params: cleanJsonObject({
          threadId: command.threadId,
          event: command.event,
        }),
      };

    case 'clean-thread-background-terminals':
      return mapThreadIdRequest({ method: 'thread/backgroundTerminals/clean', threadId: command.threadId });

    case 'inject-thread-items':
      return {
        method: 'thread/inject_items',
        params: cleanJsonObject({
          threadId: command.threadId,
          items: [...command.items],
        }),
      };

    case 'read-thread':
      return {
        method: 'thread/read',
        params: cleanJsonObject({
          threadId: command.threadId,
          includeTurns: command.includeTurns,
        }),
      };

    case 'list-threads':
      return {
        method: 'thread/list',
        params: cleanJsonObject({
          cursor: nullToUndefined(command.cursor),
          cwd: command.workspace,
          limit: command.limit,
          sortKey: nullToUndefined(command.sortKey),
          sortDirection: nullToUndefined(command.sortDirection),
          modelProviders: nullToUndefined(command.modelProviders),
          sourceKinds: nullToUndefined(command.sourceKinds),
          archived: command.archived,
          useStateDbOnly: nullToUndefined(command.useStateDbOnly),
          searchTerm: nullToUndefined(command.searchTerm),
        }),
      };

    case 'list-loaded-threads':
      return {
        method: 'thread/loaded/list',
        params: cleanJsonObject({
          cursor: nullToUndefined(command.cursor),
          limit: nullToUndefined(command.limit),
        }),
      };

    case 'list-thread-turns':
      return {
        method: 'thread/turns/list',
        params: cleanJsonObject({
          threadId: command.threadId,
          cursor: nullToUndefined(command.cursor),
          limit: nullToUndefined(command.limit),
          sortDirection: nullToUndefined(command.sortDirection),
        }),
      };

    case 'rollback-thread':
      return {
        method: 'thread/rollback',
        params: cleanJsonObject({
          threadId: command.threadId,
          numTurns: command.numTurns,
        }),
      };

    case 'start-turn':
      assertNoTurnPermissionConflict(command);
      return {
        method: 'turn/start',
        params: cleanJsonObject({
          threadId: command.threadId,
          input: mapRuntimeContent(command.content, command.message),
          ...mapRuntimeSettingsToTurnParams(command.runtimeSettings),
          cwd: nullToUndefined(command.cwd),
          approvalPolicy: nullToUndefined(command.approvalPolicy ?? command.runtimeSettings?.approvalPolicy ?? null),
          approvalsReviewer: command.approvalsReviewer,
          sandboxPolicy: command.sandboxPolicy ?? mapSandboxPolicy(command.runtimeSettings?.sandboxMode ?? null),
          permissionProfile: nullToUndefined(command.permissionProfile),
          serviceTier: command.serviceTier,
          summary: command.summary,
          personality: command.personality,
          outputSchema: command.outputSchema,
          collaborationMode: command.collaborationMode,
          responsesapiClientMetadata: nullToUndefined(command.responsesapiClientMetadata),
          environments: mapTurnEnvironments(command.environments),
        }),
      };

    case 'steer-turn':
      return {
        method: 'turn/steer',
        params: cleanJsonObject({
          threadId: command.threadId,
          input: mapRuntimeContent(command.content, command.message),
          responsesapiClientMetadata: nullToUndefined(command.responsesapiClientMetadata),
          expectedTurnId: command.expectedTurnId,
        }),
      };

    case 'start-review':
      return {
        method: 'review/start',
        params: cleanJsonObject({
          threadId: command.threadId,
          target: command.target,
          delivery: command.delivery,
        }),
      };

    case 'interrupt-turn':
      return {
        method: 'turn/interrupt',
        params: cleanJsonObject({
          threadId: command.threadId,
          turnId: command.turnId ?? '',
        }),
      };
  }
}

export interface MapRuntimeCommandInput {
  readonly dynamicTools: readonly JsonValue[];
}

interface MapThreadIdRequestInput {
  readonly method: string;
  readonly threadId: string;
}

function mapThreadIdRequest(input: MapThreadIdRequestInput): CodexRequest {
  return {
    method: input.method,
    params: cleanJsonObject({
      threadId: input.threadId,
    }),
  };
}

interface RuntimeThreadPermissionInput {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly permissionProfile?: JsonValue;
}

interface RuntimeTurnPermissionInput {
  readonly runtimeSettings: RuntimeSettings | null;
  readonly sandboxPolicy?: JsonValue;
  readonly permissionProfile?: JsonValue;
}

function assertNoThreadPermissionConflict(input: RuntimeThreadPermissionInput): void {
  if (input.permissionProfile !== undefined && input.permissionProfile !== null && input.runtimeSettings?.sandboxMode) {
    throw new CodexProtocolError('Codex thread request cannot combine permissionProfile with sandbox');
  }
}

function assertNoTurnPermissionConflict(input: RuntimeTurnPermissionInput): void {
  const hasRuntimeSandboxMode = input.runtimeSettings?.sandboxMode !== undefined && input.runtimeSettings.sandboxMode !== null;
  const hasSandboxPolicy = (input.sandboxPolicy !== undefined && input.sandboxPolicy !== null) || hasRuntimeSandboxMode;

  if (input.permissionProfile !== undefined && input.permissionProfile !== null && hasSandboxPolicy) {
    throw new CodexProtocolError('Codex turn request cannot combine permissionProfile with sandboxPolicy');
  }
}

function mapRuntimeSettingsToThreadParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: nullToUndefined(settings.model),
    approvalPolicy: nullToUndefined(settings.approvalPolicy),
    sandbox: nullToUndefined(settings.sandboxMode),
  });
}

function mapRuntimeSettingsToTurnParams(settings: RuntimeSettings | null): JsonObject {
  if (!settings) {
    return {};
  }

  return cleanJsonObject({
    model: nullToUndefined(settings.model),
    effort: nullToUndefined(settings.reasoningEffort),
    approvalPolicy: nullToUndefined(settings.approvalPolicy),
  });
}

function mergeThreadConfig(settings: RuntimeSettings | null, config: JsonObject | null | undefined): JsonObject | undefined {
  const runtimeConfig = cleanJsonObject({
    model_reasoning_effort: nullToUndefined(settings?.reasoningEffort ?? null),
    prompt_override: nullToUndefined(settings?.promptOverride ?? null),
  });
  const merged = cleanJsonObject({
    ...config,
    ...runtimeConfig,
  });

  return Object.keys(merged).length ? merged : undefined;
}

function mapSandboxPolicy(sandboxMode: RuntimeSandboxMode | null): JsonValue | undefined {
  switch (sandboxMode) {
    case null:
      return undefined;
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
    switch (item.kind) {
      case 'text':
        return cleanJsonObject({
          type: 'text',
          text: item.text || fallbackText,
          text_elements: mapTextElements(item.textElements),
        });

      case 'image':
        return cleanJsonObject({
          type: 'localImage',
          path: item.imagePath,
        });

      case 'remote-image':
        return cleanJsonObject({
          type: 'image',
          url: item.imageUrl,
        });

      case 'skill':
        return cleanJsonObject({
          type: 'skill',
          name: item.name,
          path: item.path,
        });

      case 'mention':
        return cleanJsonObject({
          type: 'mention',
          name: item.name,
          path: item.path,
        });
    }
  });
}

function mapTextElements(textElements: readonly { readonly byteRange: { readonly start: number; readonly end: number }; readonly placeholder: string | null }[] | undefined): readonly JsonValue[] {
  if (!textElements?.length) {
    return [];
  }

  return textElements.map(element => cleanJsonObject({
    byteRange: cleanJsonObject({
      start: element.byteRange.start,
      end: element.byteRange.end,
    }),
    placeholder: nullToUndefined(element.placeholder),
  }));
}

function mapTurnEnvironments(environments: readonly RuntimeTurnEnvironment[] | null | undefined): readonly JsonValue[] | undefined {
  if (!environments?.length) {
    return undefined;
  }

  return environments.map(environment => cleanJsonObject({
    environmentId: environment.environmentId,
    cwd: environment.cwd,
  }));
}

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function cleanJsonObject(input: Record<string, JsonValue | undefined>): JsonObject {
  const output: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    output[key] = value;
  }

  return output;
}
