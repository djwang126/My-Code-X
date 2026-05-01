import { z } from 'zod';

export const clientConversationItemSchema = z.object({
  id: z.string(),
  text: z.string(),
}).strict();

export type ClientConversationItem = Readonly<z.infer<typeof clientConversationItemSchema>>;

export const clientConversationErrorSchema = z.object({
  message: z.string(),
}).strict();

export type ClientConversationError = Readonly<z.infer<typeof clientConversationErrorSchema>>;

const clientConversationLoadingViewSchema = z.object({
  status: z.literal('loading'),
}).strict();

const clientConversationReadyViewSchema = z.object({
  status: z.literal('ready'),
  revision: z.number().int().nonnegative(),
  items: z.array(clientConversationItemSchema),
}).strict();

const clientConversationFailedViewSchema = z.object({
  status: z.literal('failed'),
  error: clientConversationErrorSchema,
}).strict();

export const clientConversationViewSchema = z.discriminatedUnion('status', [
  clientConversationLoadingViewSchema,
  clientConversationReadyViewSchema,
  clientConversationFailedViewSchema,
]);

export type ClientConversationLoadingView = Readonly<z.infer<typeof clientConversationLoadingViewSchema>>;
export type ClientConversationReadyView = Readonly<
  Omit<z.infer<typeof clientConversationReadyViewSchema>, 'items'> & {
    readonly items: readonly ClientConversationItem[];
  }
>;
export type ClientConversationFailedView = Readonly<
  Omit<z.infer<typeof clientConversationFailedViewSchema>, 'error'> & {
    readonly error: ClientConversationError;
  }
>;

export type ClientConversationView =
  | ClientConversationLoadingView
  | ClientConversationReadyView
  | ClientConversationFailedView;
