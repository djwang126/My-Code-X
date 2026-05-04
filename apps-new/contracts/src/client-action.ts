import { z } from 'zod';
import { jsonObjectSchema } from './json.js';

export const clientActionKindSchema = z.enum([
  'open-client',
  'send-message',
  'resume-thread',
  'respond-interaction',
  'interrupt-turn',
  'open-workspace-panel',
  'add-workspace',
  'rename-workspace',
  'edit-workspace-cwd',
  'remove-workspace',
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

const clientOpenWorkspacePanelActionSchema = z.object({
  kind: z.literal('open-workspace-panel'),
  scope: clientActionScopeSchema,
  payload: z.object({}).strict(),
}).strict();

const clientAddWorkspaceActionSchema = z.object({
  kind: z.literal('add-workspace'),
  scope: clientActionScopeSchema,
  payload: z.object({
    cwd: z.string(),
    name: z.string(),
  }).strict(),
}).strict();

const clientRenameWorkspaceActionSchema = z.object({
  kind: z.literal('rename-workspace'),
  scope: clientActionScopeSchema,
  payload: z.object({
    recordRef: z.string().nullable(),
    currentWorkspaceId: z.string(),
    name: z.string(),
  }).strict(),
}).strict();

const clientEditWorkspaceCwdActionSchema = z.object({
  kind: z.literal('edit-workspace-cwd'),
  scope: clientActionScopeSchema,
  payload: z.object({
    recordRef: z.string().nullable(),
    currentWorkspaceId: z.string(),
    cwd: z.string(),
  }).strict(),
}).strict();

const clientRemoveWorkspaceActionSchema = z.object({
  kind: z.literal('remove-workspace'),
  scope: clientActionScopeSchema,
  payload: z.object({
    recordRef: z.string().nullable(),
    currentWorkspaceId: z.string(),
  }).strict(),
}).strict();

export const clientActionSchema = z.discriminatedUnion('kind', [
  clientOpenActionSchema,
  clientSendMessageActionSchema,
  clientResumeThreadActionSchema,
  clientRespondInteractionActionSchema,
  clientInterruptTurnActionSchema,
  clientOpenWorkspacePanelActionSchema,
  clientAddWorkspaceActionSchema,
  clientRenameWorkspaceActionSchema,
  clientEditWorkspaceCwdActionSchema,
  clientRemoveWorkspaceActionSchema,
]);

export type ClientAction = Readonly<z.infer<typeof clientActionSchema>>;
export type ClientOpenAction = Readonly<z.infer<typeof clientOpenActionSchema>>;
export type ClientSendMessageAction = Readonly<z.infer<typeof clientSendMessageActionSchema>>;
export type ClientResumeThreadAction = Readonly<z.infer<typeof clientResumeThreadActionSchema>>;
export type ClientRespondInteractionAction = Readonly<z.infer<typeof clientRespondInteractionActionSchema>>;
export type ClientInterruptTurnAction = Readonly<z.infer<typeof clientInterruptTurnActionSchema>>;
export type ClientOpenWorkspacePanelAction = Readonly<z.infer<typeof clientOpenWorkspacePanelActionSchema>>;
export type ClientAddWorkspaceAction = Readonly<z.infer<typeof clientAddWorkspaceActionSchema>>;
export type ClientRenameWorkspaceAction = Readonly<z.infer<typeof clientRenameWorkspaceActionSchema>>;
export type ClientEditWorkspaceCwdAction = Readonly<z.infer<typeof clientEditWorkspaceCwdActionSchema>>;
export type ClientRemoveWorkspaceAction = Readonly<z.infer<typeof clientRemoveWorkspaceActionSchema>>;
