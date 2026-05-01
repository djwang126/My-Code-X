import { z } from 'zod';
import { jsonObjectSchema } from './json.js';

export const clientActionKindSchema = z.enum([
  'open-client',
  'send-message',
  'resume-thread',
  'respond-interaction',
  'interrupt-turn',
]);

export type ClientActionKind = z.infer<typeof clientActionKindSchema>;

export const clientActionScopeSchema = z.object({
  slotId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  threadId: z.string().nullable(),
}).strict();

export type ClientActionScope = Readonly<z.infer<typeof clientActionScopeSchema>>;

const clientOpenActionSchema = z.object({
  kind: z.literal('open-client'),
  scope: clientActionScopeSchema,
  payload: jsonObjectSchema,
}).strict();

const clientSendMessageActionSchema = z.object({
  kind: z.literal('send-message'),
  scope: clientActionScopeSchema,
  payload: jsonObjectSchema,
}).strict();

const clientResumeThreadActionSchema = z.object({
  kind: z.literal('resume-thread'),
  scope: clientActionScopeSchema,
  payload: jsonObjectSchema,
}).strict();

const clientRespondInteractionActionSchema = z.object({
  kind: z.literal('respond-interaction'),
  scope: clientActionScopeSchema,
  payload: jsonObjectSchema,
}).strict();

const clientInterruptTurnActionSchema = z.object({
  kind: z.literal('interrupt-turn'),
  scope: clientActionScopeSchema,
  payload: jsonObjectSchema,
}).strict();

export const clientActionSchema = z.discriminatedUnion('kind', [
  clientOpenActionSchema,
  clientSendMessageActionSchema,
  clientResumeThreadActionSchema,
  clientRespondInteractionActionSchema,
  clientInterruptTurnActionSchema,
]);

export type ClientAction = Readonly<z.infer<typeof clientActionSchema>>;
export type ClientOpenAction = Readonly<z.infer<typeof clientOpenActionSchema>>;
export type ClientSendMessageAction = Readonly<z.infer<typeof clientSendMessageActionSchema>>;
export type ClientResumeThreadAction = Readonly<z.infer<typeof clientResumeThreadActionSchema>>;
export type ClientRespondInteractionAction = Readonly<z.infer<typeof clientRespondInteractionActionSchema>>;
export type ClientInterruptTurnAction = Readonly<z.infer<typeof clientInterruptTurnActionSchema>>;
