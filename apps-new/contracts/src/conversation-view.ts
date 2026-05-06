import { z } from 'zod';
import { jsonValueSchema, type JsonValue } from './json.js';

export const clientConversationMessageItemSchema = z.object({
  id: z.string(),
  kind: z.literal('message'),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
}).strict();

export const clientConversationItemFieldSchema = z.object({
  name: z.string(),
  value: jsonValueSchema,
}).strict();

export const clientConversationWorkTraceItemSchema = z.object({
  id: z.string(),
  kind: z.literal('work-trace'),
  codexType: z.string(),
  fields: z.array(clientConversationItemFieldSchema),
}).strict();

export const clientConversationUnknownItemSchema = z.object({
  id: z.string(),
  kind: z.literal('unknown'),
  codexType: z.string(),
  fields: z.array(clientConversationItemFieldSchema),
}).strict();

export const clientConversationErrorItemSchema = z.object({
  id: z.string(),
  kind: z.literal('error'),
  message: z.string(),
}).strict();

export const clientConversationItemSchema = z.discriminatedUnion('kind', [
  clientConversationMessageItemSchema,
  clientConversationWorkTraceItemSchema,
  clientConversationUnknownItemSchema,
  clientConversationErrorItemSchema,
]);

export type ClientConversationMessageItem = Readonly<z.infer<typeof clientConversationMessageItemSchema>>;
export type ClientConversationItemField = Readonly<
  Omit<z.infer<typeof clientConversationItemFieldSchema>, 'value'> & {
    readonly value: JsonValue;
  }
>;
export type ClientConversationWorkTraceItem = Readonly<
  Omit<z.infer<typeof clientConversationWorkTraceItemSchema>, 'fields'> & {
    readonly fields: readonly ClientConversationItemField[];
  }
>;
export type ClientConversationUnknownItem = Readonly<
  Omit<z.infer<typeof clientConversationUnknownItemSchema>, 'fields'> & {
    readonly fields: readonly ClientConversationItemField[];
  }
>;
export type ClientConversationErrorItem = Readonly<z.infer<typeof clientConversationErrorItemSchema>>;
export type ClientConversationItem =
  | ClientConversationMessageItem
  | ClientConversationWorkTraceItem
  | ClientConversationUnknownItem
  | ClientConversationErrorItem;

export const clientConversationErrorSchema = z.object({
  message: z.string(),
}).strict();

export type ClientConversationError = Readonly<z.infer<typeof clientConversationErrorSchema>>;

const clientConversationLoadingViewSchema = z.object({
  status: z.literal('loading'),
  revision: z.number().int().nonnegative(),
}).strict();

export const clientConversationReadyViewSchema = z.object({
  status: z.literal('ready'),
  revision: z.number().int().nonnegative(),
  items: z.array(clientConversationItemSchema),
}).strict();

const clientConversationFailedViewSchema = z.object({
  status: z.literal('failed'),
  revision: z.number().int().nonnegative(),
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
