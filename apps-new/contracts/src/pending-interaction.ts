import { z } from 'zod';
import { jsonValueSchema, type JsonValue } from './json.js';

export const pendingInteractionLifecycleSchema = z.enum(['open', 'submitting', 'resolved', 'expired']);
export type PendingInteractionLifecycle = z.infer<typeof pendingInteractionLifecycleSchema>;

const pendingInteractionButtonControlSchema = z.object({
  kind: z.literal('button'),
  id: z.string(),
  label: z.string(),
  style: z.enum(['primary', 'normal', 'danger']),
}).strict();

const pendingInteractionInputControlSchema = z.object({
  kind: z.literal('input'),
  id: z.string(),
  label: z.string(),
  secret: z.boolean(),
}).strict();

const pendingInteractionChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
}).strict();

const pendingInteractionChoiceControlSchema = z.object({
  kind: z.literal('choice'),
  id: z.string(),
  label: z.string(),
  choices: z.array(pendingInteractionChoiceSchema),
}).strict();

export const pendingInteractionControlSchema = z.discriminatedUnion('kind', [
  pendingInteractionButtonControlSchema,
  pendingInteractionInputControlSchema,
  pendingInteractionChoiceControlSchema,
]);

export const pendingInteractionResponseShapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('decision') }).strict(),
  z.object({ kind: z.literal('form') }).strict(),
  z.object({ kind: z.literal('freeform') }).strict(),
  z.object({ kind: z.literal('structured'), schema: jsonValueSchema }).strict(),
]);

const pendingInteractionBaseSchema = z.object({
  id: z.string(),
  lifecycle: pendingInteractionLifecycleSchema,
  title: z.string(),
  body: z.string(),
  controls: z.array(pendingInteractionControlSchema),
  responseShape: pendingInteractionResponseShapeSchema,
}).strict();

const approvalInteractionSchema = pendingInteractionBaseSchema.extend({
  kind: z.literal('approval'),
}).strict();

const formInteractionSchema = pendingInteractionBaseSchema.extend({
  kind: z.literal('form'),
}).strict();

const authInteractionSchema = pendingInteractionBaseSchema.extend({
  kind: z.literal('auth'),
}).strict();

const toolResponseInteractionSchema = pendingInteractionBaseSchema.extend({
  kind: z.literal('tool-response'),
}).strict();

export const pendingInteractionSchema = z.discriminatedUnion('kind', [
  approvalInteractionSchema,
  formInteractionSchema,
  authInteractionSchema,
  toolResponseInteractionSchema,
]);

type PendingInteractionChoiceControlShape = z.infer<typeof pendingInteractionChoiceControlSchema>;
type PendingInteractionBaseShape = z.infer<typeof pendingInteractionBaseSchema>;
type ApprovalInteractionShape = z.infer<typeof approvalInteractionSchema>;
type FormInteractionShape = z.infer<typeof formInteractionSchema>;
type AuthInteractionShape = z.infer<typeof authInteractionSchema>;
type ToolResponseInteractionShape = z.infer<typeof toolResponseInteractionSchema>;

export type PendingInteractionButtonControl = Readonly<z.infer<typeof pendingInteractionButtonControlSchema>>;
export type PendingInteractionInputControl = Readonly<z.infer<typeof pendingInteractionInputControlSchema>>;
export type PendingInteractionChoice = Readonly<z.infer<typeof pendingInteractionChoiceSchema>>;
export type PendingInteractionChoiceControl = Readonly<
  Omit<PendingInteractionChoiceControlShape, 'choices'> & {
    readonly choices: readonly PendingInteractionChoice[];
  }
>;
export type PendingInteractionControl =
  | PendingInteractionButtonControl
  | PendingInteractionInputControl
  | PendingInteractionChoiceControl;
export type PendingInteractionDecisionResponseShape = Readonly<{ readonly kind: 'decision' }>;
export type PendingInteractionFormResponseShape = Readonly<{ readonly kind: 'form' }>;
export type PendingInteractionFreeformResponseShape = Readonly<{ readonly kind: 'freeform' }>;
export type PendingInteractionStructuredResponseShape = Readonly<{
  readonly kind: 'structured';
  readonly schema: JsonValue;
}>;
export type PendingInteractionResponseShape =
  | PendingInteractionDecisionResponseShape
  | PendingInteractionFormResponseShape
  | PendingInteractionFreeformResponseShape
  | PendingInteractionStructuredResponseShape;
export type PendingInteractionBase = Readonly<
  Omit<PendingInteractionBaseShape, 'controls' | 'responseShape'> & {
    readonly controls: readonly PendingInteractionControl[];
    readonly responseShape: PendingInteractionResponseShape;
  }
>;
export type ApprovalInteraction = Readonly<
  Omit<ApprovalInteractionShape, keyof PendingInteractionBase> & PendingInteractionBase
>;
export type FormInteraction = Readonly<
  Omit<FormInteractionShape, keyof PendingInteractionBase> & PendingInteractionBase
>;
export type AuthInteraction = Readonly<
  Omit<AuthInteractionShape, keyof PendingInteractionBase> & PendingInteractionBase
>;
export type ToolResponseInteraction = Readonly<
  Omit<ToolResponseInteractionShape, keyof PendingInteractionBase> & PendingInteractionBase
>;
export type PendingInteraction =
  | ApprovalInteraction
  | FormInteraction
  | AuthInteraction
  | ToolResponseInteraction;
