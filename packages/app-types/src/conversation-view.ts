import { z } from "zod";

export const userInputEntryBodySchema = z.object({
  kind: z.literal("UserInput"),
  markdown: z.string()
});

export const agentReplyEntryBodySchema = z.object({
  kind: z.literal("AgentReply"),
  content: z.string(),
  stream: z.union([z.literal("InProgress"), z.literal("Completed")])
});

export const workProgressEntryBodySchema = z.object({
  kind: z.literal("WorkProgress"),
  nativeType: z.string().optional(),
  nativeStatus: z.string().optional(),
  detail: z.record(z.string(), z.unknown())
});

export const failureEntryBodySchema = z.object({
  kind: z.literal("Failure"),
  message: z.string(),
  detail: z.record(z.string(), z.unknown())
});

export const unrecognizedEntryBodySchema = z.object({
  kind: z.literal("Unrecognized"),
  nativeStatus: z.string().optional(),
  detail: z.record(z.string(), z.unknown())
});

export const entryBodySchema = z.discriminatedUnion("kind", [
  userInputEntryBodySchema,
  agentReplyEntryBodySchema,
  workProgressEntryBodySchema,
  failureEntryBodySchema,
  unrecognizedEntryBodySchema
]);

export const transcriptEntrySchema = z.object({
  id: z.string(),
  sequence: z.number(),
  body: entryBodySchema
});

export const contentRestoreStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Restoring") }),
  z.object({ kind: z.literal("Restored") }),
  z.object({ kind: z.literal("RestoredEmpty") }),
  z.object({ kind: z.literal("RestoreFailed") })
]);

export const turnStatusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("InProgress"),
    firstUserInputRef: z.string(),
    userInputTime: z.string()
  }),
  z.object({
    kind: z.literal("Completed"),
    firstUserInputRef: z.string(),
    userInputTime: z.string(),
    lastAgentReplyRef: z.string(),
    lastReplyCompletedTime: z.string()
  })
]);

export const turnSchema = z.object({
  id: z.string(),
  status: turnStatusSchema
});

export const interactionOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiresTextSupplement: z.boolean()
});

export const interactionResponseSchema = z.object({
  selectedOption: z.string(),
  textSupplement: z.string().optional()
});

export const interactionStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Pending") }),
  z.object({
    kind: z.literal("Resolved"),
    acceptedResponse: interactionResponseSchema
  }),
  z.object({ kind: z.literal("Expired") }),
  z.object({ kind: z.literal("Cancelled") })
]);

export const interactionSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  content: z.object({
    prompt: z.string(),
    options: z.array(interactionOptionSchema)
  }),
  status: interactionStatusSchema
});

export const conversationSnapshotSchema = z.object({
  conversation: z.object({
    id: z.string(),
    contentRestore: contentRestoreStatusSchema
  }),
  transcriptEntries: z.array(transcriptEntrySchema),
  turns: z.array(turnSchema),
  pendingInteractions: z.array(interactionSchema),
  cursor: z.string()
});

export const inputSendOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("Accepted") }),
  z.object({
    outcome: z.literal("SendFailed"),
    error: z.object({
      message: z.string()
    })
  })
]);

export const conversationStreamEventSchema = z.object({
  id: z.string(),
  type: z.literal("transcript.entry-added"),
  data: z.object({
    entry: transcriptEntrySchema
  })
});

export type UserInputEntryBody = z.infer<typeof userInputEntryBodySchema>;
export type AgentReplyEntryBody = z.infer<typeof agentReplyEntryBodySchema>;
export type WorkProgressEntryBody = z.infer<typeof workProgressEntryBodySchema>;
export type FailureEntryBody = z.infer<typeof failureEntryBodySchema>;
export type UnrecognizedEntryBody = z.infer<typeof unrecognizedEntryBodySchema>;
export type EntryBody = z.infer<typeof entryBodySchema>;
export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
export type ContentRestoreStatus = z.infer<typeof contentRestoreStatusSchema>;
export type TurnStatus = z.infer<typeof turnStatusSchema>;
export type Turn = z.infer<typeof turnSchema>;
export type InteractionOption = z.infer<typeof interactionOptionSchema>;
export type InteractionResponse = z.infer<typeof interactionResponseSchema>;
export type InteractionStatus = z.infer<typeof interactionStatusSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type ConversationSnapshot = z.infer<typeof conversationSnapshotSchema>;
export type InputSendOutcome = z.infer<typeof inputSendOutcomeSchema>;
export type ConversationStreamEvent = z.infer<typeof conversationStreamEventSchema>;
