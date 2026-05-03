import type {
  InterruptRuntimeTurnCommand,
  StartRuntimeReviewCommand,
  StartRuntimeTurnCommand,
  SteerRuntimeTurnCommand,
} from '../../../../ports/index.js';
import type { CodexRequest } from '../../protocol/codex-request.js';
import { assertNoTurnPermissionConflict } from './command-permission-guard.js';
import { cleanJsonObject, nullToUndefined } from './clean-json-object.js';
import { encodeRuntimeContent } from './encode-runtime-content.js';
import { encodeRuntimeSettingsToTurnParams } from './encode-runtime-settings.js';
import { encodeSandboxPolicy } from './encode-sandbox-policy.js';
import { mapTurnEnvironments } from './encode-turn-environments.js';
import { assertNever } from '../../../../shared/index.js';

export type RuntimeTurnCommand = StartRuntimeTurnCommand | SteerRuntimeTurnCommand | StartRuntimeReviewCommand | InterruptRuntimeTurnCommand;

export function encodeTurnCommand(command: RuntimeTurnCommand): CodexRequest {
  switch (command.kind) {
    case 'start-turn':
      assertNoTurnPermissionConflict(command);
      return {
        method: 'turn/start',
        params: cleanJsonObject({
          threadId: command.threadId,
          input: encodeRuntimeContent(command.content, command.message),
          ...encodeRuntimeSettingsToTurnParams(command.runtimeSettings),
          cwd: nullToUndefined(command.cwd),
          approvalPolicy: nullToUndefined(command.approvalPolicy ?? command.runtimeSettings?.approvalPolicy ?? null),
          approvalsReviewer: command.approvalsReviewer,
          sandboxPolicy: command.sandboxPolicy ?? encodeSandboxPolicy(command.runtimeSettings?.sandboxMode ?? null),
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
          input: encodeRuntimeContent(command.content, command.message),
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

  return assertNever(command, 'Unsupported runtime turn command');
}

