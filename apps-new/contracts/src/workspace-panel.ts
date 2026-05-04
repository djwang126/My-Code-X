import { z } from 'zod';

export const clientWorkspaceErrorViewSchema = z.object({
  code: z.string(),
  message: z.string(),
}).strict();

export const clientWorkspaceAvailabilityViewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('available'),
  }).strict(),
  z.object({
    status: z.literal('unavailable'),
    reason: z.string(),
  }).strict(),
]);

export const clientWorkspaceOperationSchema = z.enum(['rename', 'edit-cwd', 'remove']);

export const clientWorkspacePersistenceViewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('persistent'),
  }).strict(),
  z.object({
    status: z.literal('memory'),
    warning: z.string(),
    error: clientWorkspaceErrorViewSchema,
  }).strict(),
]);

export const clientWorkspaceListItemViewSchema = z.object({
  workspaceId: z.string(),
  recordRef: z.string(),
  name: z.string(),
  cwd: z.string(),
  availability: clientWorkspaceAvailabilityViewSchema,
  selected: z.boolean(),
  operations: z.array(clientWorkspaceOperationSchema),
}).strict();

export const clientWorkspaceListViewSchema = z.object({
  persistence: clientWorkspacePersistenceViewSchema,
  selectedWorkspaceId: z.string().nullable(),
  items: z.array(clientWorkspaceListItemViewSchema),
}).strict();

export const clientWorkspacePanelViewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('loading'),
  }).strict(),
  z.object({
    status: z.literal('failed'),
    error: clientWorkspaceErrorViewSchema,
  }).strict(),
  z.object({
    status: z.literal('ready'),
    list: clientWorkspaceListViewSchema,
  }).strict(),
]);

type ClientWorkspaceListItemViewShape = z.infer<typeof clientWorkspaceListItemViewSchema>;
type ClientWorkspaceListViewShape = z.infer<typeof clientWorkspaceListViewSchema>;
type ClientWorkspacePanelViewShape = z.infer<typeof clientWorkspacePanelViewSchema>;

export type ClientWorkspaceErrorView = Readonly<z.infer<typeof clientWorkspaceErrorViewSchema>>;
export type ClientWorkspaceAvailabilityView = Readonly<z.infer<typeof clientWorkspaceAvailabilityViewSchema>>;
export type ClientWorkspaceOperation = z.infer<typeof clientWorkspaceOperationSchema>;
export type ClientWorkspacePersistenceView = Readonly<z.infer<typeof clientWorkspacePersistenceViewSchema>>;
export type ClientWorkspaceListItemView = Readonly<
  Omit<ClientWorkspaceListItemViewShape, 'availability' | 'operations'> & {
    readonly availability: ClientWorkspaceAvailabilityView;
    readonly operations: readonly ClientWorkspaceOperation[];
  }
>;
export type ClientWorkspaceListView = Readonly<
  Omit<ClientWorkspaceListViewShape, 'items' | 'persistence'> & {
    readonly persistence: ClientWorkspacePersistenceView;
    readonly items: readonly ClientWorkspaceListItemView[];
  }
>;
export type ClientWorkspacePanelView = Readonly<
  | Extract<ClientWorkspacePanelViewShape, { readonly status: 'loading' }>
  | Extract<ClientWorkspacePanelViewShape, { readonly status: 'failed' }>
  | (Omit<Extract<ClientWorkspacePanelViewShape, { readonly status: 'ready' }>, 'list'> & {
    readonly list: ClientWorkspaceListView;
  })
>;
