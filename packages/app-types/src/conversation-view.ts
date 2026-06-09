import { z } from "zod";

export const classificationSchema = z.enum([
  "NormalConversation",
  "WorkProcess",
  "Failure",
  "Unrecognized"
]);

export const messageContentFieldSchema = z.object({
  name: z.string(),
  value: z.string()
});

export const messageContentSchema = z.object({
  fields: z.array(messageContentFieldSchema)
});

export const messageSchema = z.object({
  stableKey: z.string(),
  sequence: z.number().int(),
  classification: classificationSchema,
  nativeType: z.string().nullable(),
  nativeStatus: z.string().nullable(),
  belongsToTurn: z.string().nullable(),
  content: messageContentSchema
});

export const turnStateSchema = z.enum(["InProgress", "Interrupting", "Ended"]);

export const turnSchema = z.object({
  turnId: z.string(),
  state: turnStateSchema,
  startTime: z.string().nullable(),
  endTime: z.string().nullable()
});

const conversationSnapshotSchema = z.object({
  messages: z.array(messageSchema),
  turns: z.array(turnSchema)
});

export const recoveredSnapshotSchema = conversationSnapshotSchema.superRefine(
  (snapshot, context) => {
    for (const [index, turn] of snapshot.turns.entries()) {
      if (turn.state !== "Ended") {
        context.addIssue({
          code: "custom",
          message: "RecoveredSnapshot cannot contain running turns",
          path: ["turns", index, "state"]
        });
      }
    }
  }
);

export const authoritativeSnapshotSchema = conversationSnapshotSchema;

export const interactionStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Pending") }),
  z.object({ kind: z.literal("Responded") }),
  z.object({ kind: z.literal("Invalidated") })
]);

export const responseOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiresSupplement: z.boolean()
});

export const interactionContentSchema = z.object({
  prompt: z.string(),
  options: z.array(responseOptionSchema)
});

export const pendingInteractionSchema = z.object({
  interactionId: z.string(),
  conversationId: z.string(),
  state: interactionStateSchema,
  content: interactionContentSchema
});

export const messageDeltaSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("AppendDelta"),
    stableKey: z.string(),
    fields: z.array(messageContentFieldSchema)
  }),
  z.object({
    mode: z.literal("FullReplace"),
    message: messageSchema
  })
]);

const cursorCarryingEventFields = {
  resumeCursor: z.string().nullable()
};

export const agentCliDomainEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("MessageAppended"),
    ...cursorCarryingEventFields,
    message: messageSchema
  }),
  z.object({
    kind: z.literal("MessageUpdated"),
    ...cursorCarryingEventFields,
    delta: messageDeltaSchema
  }),
  z.object({
    kind: z.literal("TurnChanged"),
    ...cursorCarryingEventFields,
    turn: turnSchema
  }),
  z.object({
    kind: z.literal("PendingInteractionRaised"),
    interaction: pendingInteractionSchema
  }),
  z.object({
    kind: z.literal("PendingInteractionExpired"),
    interactionId: z.string()
  }),
  z.object({
    kind: z.literal("UnattributedErrorRaised"),
    message: z.string()
  }),
  z.object({
    kind: z.literal("ProtocolViolation"),
    reason: z.string()
  })
]);

export const agentCapabilitySchema = z.object({
  supportsInterrupt: z.boolean(),
  supportsAppend: z.boolean()
});

export const cliKindSchema = z.enum(["codex", "claude-code"]);

export const agentCliSessionSchema = z.object({
  cliKind: cliKindSchema,
  conversationId: z.string(),
  workingDirectory: z.string().nullable(),
  agentSessionId: z.string().nullable()
});

export const agentCliCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SubmitNormalInput"),
    session: agentCliSessionSchema,
    text: z.string()
  }),
  z.object({
    kind: z.literal("AppendInstruction"),
    session: agentCliSessionSchema,
    text: z.string(),
    turnId: z.string().optional()
  }),
  z.object({
    kind: z.literal("RequestWorkInterrupt"),
    session: agentCliSessionSchema,
    turnId: z.string().optional()
  }),
  z.object({
    kind: z.literal("RespondToInteraction"),
    session: agentCliSessionSchema,
    interactionId: z.string(),
    optionId: z.string(),
    supplement: z.string().optional()
  })
]);

export type Classification = z.infer<typeof classificationSchema>;
export type MessageContentField = z.infer<typeof messageContentFieldSchema>;
export type MessageContent = z.infer<typeof messageContentSchema>;
export type Message = z.infer<typeof messageSchema>;
export type TurnState = z.infer<typeof turnStateSchema>;
export type Turn = z.infer<typeof turnSchema>;
export type RecoveredSnapshot = z.infer<typeof recoveredSnapshotSchema>;
export type AuthoritativeSnapshot = z.infer<typeof authoritativeSnapshotSchema>;
export type InteractionState = z.infer<typeof interactionStateSchema>;
export type ResponseOption = z.infer<typeof responseOptionSchema>;
export type InteractionContent = z.infer<typeof interactionContentSchema>;
export type PendingInteraction = z.infer<typeof pendingInteractionSchema>;
export type MessageDelta = z.infer<typeof messageDeltaSchema>;
export type AgentCliDomainEvent = z.infer<typeof agentCliDomainEventSchema>;
export type AgentCapability = z.infer<typeof agentCapabilitySchema>;
export type CliKind = z.infer<typeof cliKindSchema>;
export type AgentCliSession = z.infer<typeof agentCliSessionSchema>;
export type AgentCliCommand = z.infer<typeof agentCliCommandSchema>;
