import {
  readBodyObject,
  readNullableStringValue,
  readOptionalObject,
  readOptionalString,
  readRequiredKind,
  readRequiredString,
} from '../http-body.js';
import { BoundaryError, type JsonObject, type JsonValue } from '../../shared/index.js';
import type { ApplicationChatCommand, ApplicationService } from '../../application/index.js';
import type { HttpHandler, HttpRequest, HttpResponse } from '../http-types.js';

type ChatRuntimeSettings = Extract<ApplicationChatCommand, { readonly kind: 'send-chat-message' }>['runtimeSettings'];
type ChatSandboxMode = NonNullable<ChatRuntimeSettings>['sandboxMode'];

export interface ChatControllerInput {
  application: ApplicationService;
}

export function createChatController(input: ChatControllerInput): HttpHandler {
  return {
    async handle(request: HttpRequest): Promise<HttpResponse> {
      return input.application.runChat(readChatCommand(request));
    },
  };
}

function readChatCommand(request: HttpRequest): ApplicationChatCommand {
  const body = readBodyObject(request);
  const kind = readRequiredKind(body, ['send-chat-message', 'interrupt-chat']);

  if (kind === 'send-chat-message') {
    return {
      kind,
      threadId: readRequiredString(body, 'threadId'),
      message: readRequiredString(body, 'message'),
      runtimeSettings: readRuntimeSettings(body),
    };
  }

  return {
    kind,
    threadId: readRequiredString(body, 'threadId'),
    turnId: readOptionalString(body, 'turnId'),
  };
}

function readRuntimeSettings(body: JsonObject): ChatRuntimeSettings {
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

function readSandboxMode(value: JsonValue | undefined): ChatSandboxMode {
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
