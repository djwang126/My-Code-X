import {
  readBodyObject,
  readBoolean,
  readNullableStringValue,
  readOptionalObject,
  readOptionalString,
  readPositiveInteger,
  readRequiredKind,
  readRequiredString,
} from '../http-body.js';
import { BoundaryError, type JsonObject, type JsonValue } from '../../shared/index.js';
import type { ApplicationService, ApplicationThreadCommand } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

type ThreadRuntimeSettings = Extract<ApplicationThreadCommand, { readonly kind: 'create-thread' }>['runtimeSettings'];
type ThreadSandboxMode = NonNullable<ThreadRuntimeSettings>['sandboxMode'];

export interface ThreadControllerInput {
  application: ApplicationService;
}

export function createThreadController(input: ThreadControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runThread(readThreadCommand(request));
    },
  };
}

function readThreadCommand(request: HttpRequest): ApplicationThreadCommand {
  const body = readBodyObject(request);
  const kind = readRequiredKind(body, ['create-thread', 'open-thread', 'list-workspace-threads']);

  if (kind === 'create-thread') {
    return {
      kind,
      workspace: readRequiredString(body, 'workspace'),
      runtimeSettings: readRuntimeSettings(body),
      baseInstructions: readOptionalString(body, 'baseInstructions'),
    };
  }

  if (kind === 'open-thread') {
    return {
      kind,
      threadId: readRequiredString(body, 'threadId'),
      workspace: readRequiredString(body, 'workspace'),
      runtimeSettings: readRuntimeSettings(body),
      baseInstructions: readOptionalString(body, 'baseInstructions'),
    };
  }

  return {
    kind,
    workspace: readRequiredString(body, 'workspace'),
    limit: readPositiveInteger(body, 'limit', 20),
    archived: readBoolean(body, 'archived', false),
  };
}

function readRuntimeSettings(body: JsonObject): ThreadRuntimeSettings {
  const settings = readOptionalObject(body, 'runtimeSettings');

  if (!settings) {
    return null;
  }

  return {
    model: readNullableStringValue(settings.model, 'runtimeSettings.model'),
    reasoningEffort: readNullableStringValue(settings.reasoningEffort, 'runtimeSettings.reasoningEffort'),
    approvalPolicy: readNullableStringValue(settings.approvalPolicy, 'runtimeSettings.approvalPolicy'),
    sandboxMode: readSandboxMode(settings.sandboxMode),
    promptOverride: readNullableStringValue(settings.promptOverride, 'runtimeSettings.promptOverride'),
  };
}

function readSandboxMode(value: JsonValue | undefined): ThreadSandboxMode {
  const sandboxMode = readNullableStringValue(value, 'runtimeSettings.sandboxMode');

  switch (sandboxMode) {
    case null:
    case 'read-only':
    case 'workspace-write':
    case 'danger-full-access':
      return sandboxMode;
    default:
      throw new BoundaryError(`Unsupported runtimeSettings.sandboxMode: ${sandboxMode}`);
  }
}
