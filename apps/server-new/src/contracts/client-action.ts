import type { JsonObject } from '../shared/index.js';

export type ClientAction =
  | ClientOpenAction
  | ClientSendMessageAction
  | ClientResumeThreadAction
  | ClientRespondInteractionAction
  | ClientInterruptTurnAction;

export interface ClientActionScope {
  readonly slotId: string | null;
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}

export interface ClientActionBase {
  readonly kind: ClientActionKind;
  readonly scope: ClientActionScope;
  readonly payload: JsonObject;
}

export type ClientActionKind =
  | 'open-client'
  | 'send-message'
  | 'resume-thread'
  | 'respond-interaction'
  | 'interrupt-turn';

export interface ClientOpenAction extends ClientActionBase {
  readonly kind: 'open-client';
}

export interface ClientSendMessageAction extends ClientActionBase {
  readonly kind: 'send-message';
}

export interface ClientResumeThreadAction extends ClientActionBase {
  readonly kind: 'resume-thread';
}

export interface ClientRespondInteractionAction extends ClientActionBase {
  readonly kind: 'respond-interaction';
}

export interface ClientInterruptTurnAction extends ClientActionBase {
  readonly kind: 'interrupt-turn';
}
