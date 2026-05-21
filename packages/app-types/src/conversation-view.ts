import { z } from "zod";
import { apiResponseSchema } from "./api-response";

export const conversationHostViewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("noConversationTarget")
  })
]);

export type ConversationHostView = z.infer<typeof conversationHostViewSchema>;

export const conversationHostViewResponseSchema = apiResponseSchema(
  conversationHostViewSchema
);
