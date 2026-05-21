import { z } from "zod";
import { apiResponseSchema } from "./api-response";

export const threadContextSchema = z.discriminatedUnion("status", [
  z.object({
    threadId: z.string(),
    title: z.string().nullable(),
    cwd: z.string().nullable(),
    updatedAt: z.string().nullable(),
    status: z.literal("idle")
  }),
  z.object({
    threadId: z.string(),
    title: z.string().nullable(),
    cwd: z.string().nullable(),
    updatedAt: z.string().nullable(),
    status: z.literal("active"),
    activeTurnId: z.string()
  }),
  z.object({
    threadId: z.string(),
    title: z.string().nullable(),
    cwd: z.string().nullable(),
    updatedAt: z.string().nullable(),
    status: z.literal("notLoaded")
  }),
  z.object({
    threadId: z.string(),
    title: z.string().nullable(),
    cwd: z.string().nullable(),
    updatedAt: z.string().nullable(),
    status: z.literal("systemError"),
    message: z.string()
  }),
  z.object({
    threadId: z.string(),
    title: z.string().nullable(),
    cwd: z.string().nullable(),
    updatedAt: z.string().nullable(),
    status: z.literal("unknown")
  })
]);

export const conversationViewSchema = z.object({
  thread: threadContextSchema,
  pageState: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("empty") })
  ]),
  timeline: z.array(z.never()),
  composer: z.object({
    threadId: z.string(),
    draft: z.string(),
    action: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("disabled"),
        enabled: z.literal(false),
        reason: z.literal("emptyDraft")
      })
    ])
  }),
  notices: z.array(z.never()),
  sync: z.object({
    connection: z.literal("unknown"),
    freshness: z.literal("unknown"),
    lastSyncedAt: z.null()
  })
});

export type ConversationView = z.infer<typeof conversationViewSchema>;

export const conversationHostViewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("noConversationTarget")
  }),
  z.object({
    kind: z.literal("conversationTargetSelected"),
    threadId: z.string(),
    conversation: conversationViewSchema
  })
]);

export type ConversationHostView = z.infer<typeof conversationHostViewSchema>;

export const conversationHostViewResponseSchema = apiResponseSchema(
  conversationHostViewSchema
);
