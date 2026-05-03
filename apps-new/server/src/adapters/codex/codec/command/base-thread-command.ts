import type {
  ForkRuntimeThreadCommand,
  ResumeRuntimeThreadCommand,
  StartRuntimeThreadCommand,
} from '../../../../ports/index.js';
import type { CodexRequest } from '../../protocol/codex-request.js';
import { assertNoThreadPermissionConflict } from './command-permission-guard.js';
import { cleanJsonObject, nullToUndefined } from './clean-json-object.js';
import type { EncodeRuntimeCommandInput } from './encode-runtime-command-input.js';
import { encodeRuntimeSettingsToThreadParams, mergeThreadConfig } from './encode-runtime-settings.js';
import { assertNever } from '../../../../shared/index.js';

export type BaseRuntimeThreadCommand = StartRuntimeThreadCommand | ResumeRuntimeThreadCommand | ForkRuntimeThreadCommand;

export function encodeBaseThreadCommand(command: BaseRuntimeThreadCommand, input: EncodeRuntimeCommandInput): CodexRequest {
  switch (command.kind) {
    case 'start-thread':
      assertNoThreadPermissionConflict(command);
      return {
        method: 'thread/start',
        params: cleanJsonObject({
          cwd: command.workspace,
          ...encodeRuntimeSettingsToThreadParams(command.runtimeSettings),
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
          ...encodeRuntimeSettingsToThreadParams(command.runtimeSettings),
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
          ...encodeRuntimeSettingsToThreadParams(command.runtimeSettings),
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
  }

  return assertNever(command, 'Unsupported base runtime thread command');
}
