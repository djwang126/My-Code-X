import { z } from 'zod';

export const clientTurnStatusSchema = z.enum(['inProgress', 'completed', 'failed', 'interrupted']);
export type ClientTurnStatus = z.infer<typeof clientTurnStatusSchema>;

export const clientTurnErrorSchema = z.object({
  message: z.string(),
  code: z.string().nullable(),
}).strict();

export const clientTurnRecordSchema = z.object({
  threadId: z.string(),
  turnId: z.string(),
  status: clientTurnStatusSchema,
  error: clientTurnErrorSchema.nullable(),
  startedAt: z.number().finite().nullable(),
  completedAt: z.number().finite().nullable(),
  durationMs: z.number().finite().nullable(),
}).strict();

export const clientTurnViewSchema = z.object({
  current: clientTurnRecordSchema.nullable(),
}).strict();

export type ClientTurnError = Readonly<z.infer<typeof clientTurnErrorSchema>>;
export type ClientTurnRecord = Readonly<z.infer<typeof clientTurnRecordSchema>>;
export type ClientTurnView = Readonly<z.infer<typeof clientTurnViewSchema>>;
