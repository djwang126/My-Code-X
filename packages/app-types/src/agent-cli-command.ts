import { z } from "zod";

export const cliKindSchema = z.enum(["codex", "claude-code"]);
export type CliKind = z.infer<typeof cliKindSchema>;

export const agentCliSessionInputSchema = z.object({
  cliKind: cliKindSchema,
  conversationId: z.string()
});

export type AgentCliSessionInput = z.infer<typeof agentCliSessionInputSchema>;

export const agentCapabilitySchema = z.object({
  supportsAppend: z.boolean(),
  supportsInterrupt: z.boolean()
});

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;

export const agentCliCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("SubmitNormalInput"),
    session: agentCliSessionInputSchema,
    text: z.string()
  }),
  z.object({
    kind: z.literal("AppendInstruction"),
    session: agentCliSessionInputSchema,
    text: z.string(),
    turnId: z.string().optional()
  }),
  z.object({
    kind: z.literal("RequestWorkInterrupt"),
    session: agentCliSessionInputSchema,
    turnId: z.string().optional()
  }),
  z.object({
    kind: z.literal("RespondToInteraction"),
    session: agentCliSessionInputSchema,
    interactionId: z.string(),
    optionId: z.string(),
    supplement: z.string().optional()
  })
]);

export type AgentCliCommand = z.infer<typeof agentCliCommandSchema>;

export const agentCliCommandResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("accepted")
  }),
  z.object({
    kind: z.literal("failed"),
    reason: z.enum(["unsupportedCapability", "relayFailed"]),
    message: z.string()
  })
]);

export type AgentCliCommandResult = z.infer<typeof agentCliCommandResultSchema>;
