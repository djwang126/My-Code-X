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

export type ThreadContext = z.infer<typeof threadContextSchema>;

export const conversationPageStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }),
  z.object({
    kind: z.literal("restoring"),
    hasReadableContent: z.boolean()
  }),
  z.object({ kind: z.literal("empty") }),
  z.object({
    kind: z.literal("restoreFailed"),
    message: z.string()
  }),
  z.object({
    kind: z.literal("stale"),
    message: z.string()
  })
]);

export type ConversationPageState = z.infer<typeof conversationPageStateSchema>;

export const displayFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  copyText: z.string().optional()
});

export const displayDetailSchema = z.object({
  fields: z.array(displayFieldSchema)
});

export type DisplayDetail = z.infer<typeof displayDetailSchema>;

const timelineItemBaseSchema = {
  id: z.string(),
  turnId: z.string().nullable(),
  occurredAt: z.string().nullable(),
  status: z.enum(["running", "completed", "failed", "unknown"])
};

export const timelineItemSchema = z.discriminatedUnion("kind", [
  z.object({
    ...timelineItemBaseSchema,
    kind: z.literal("message"),
    message: z.object({
      role: z.enum(["user", "agent"]),
      text: z.string(),
      markdown: z.boolean(),
      copyText: z.string()
    })
  }),
  z.object({
    ...timelineItemBaseSchema,
    kind: z.literal("workProgress"),
    workProgress: z.object({
      sourceType: z.string(),
      label: z.string(),
      summary: z.string().nullable(),
      detail: displayDetailSchema
    })
  }),
  z.object({
    ...timelineItemBaseSchema,
    kind: z.literal("failure"),
    failure: z.object({
      message: z.string(),
      detail: displayDetailSchema.nullable()
    })
  }),
  z.object({
    ...timelineItemBaseSchema,
    kind: z.literal("unknown"),
    unknown: z.object({
      sourceType: z.string(),
      statusLabel: z.string().nullable(),
      detail: displayDetailSchema
    })
  })
]);

export type TimelineItem = z.infer<typeof timelineItemSchema>;

export const composerViewSchema = z.object({
  threadId: z.string(),
  draft: z.string(),
  action: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("send"),
      enabled: z.literal(true)
    }),
    z.object({
      kind: z.literal("steer"),
      enabled: z.literal(true),
      expectedTurnId: z.string()
    }),
    z.object({
      kind: z.literal("interrupt"),
      enabled: z.literal(true),
      turnId: z.string(),
      requiresConfirmation: z.literal(true)
    }),
    z.object({
      kind: z.literal("disabled"),
      enabled: z.literal(false),
      reason: z.enum([
        "restoring",
        "connectionUnavailable",
        "unreliableThreadTarget",
        "unreliableTurnTarget",
        "emptyDraft",
        "systemError",
        "unknown"
      ])
    })
  ])
});

export type ComposerView = z.infer<typeof composerViewSchema>;
export type ComposerAction = ComposerView["action"];
export type ComposerDisabledReason =
  Extract<ComposerAction, { kind: "disabled" }>["reason"];

export const pageNoticeSchema = z.object({
  id: z.string(),
  level: z.enum(["info", "warning", "error"]),
  message: z.string(),
  createdAt: z.string(),
  autoDismissMs: z.number().nullable(),
  detail: displayDetailSchema.nullable()
});

export type PageNotice = z.infer<typeof pageNoticeSchema>;

export const conversationSyncStateSchema = z.object({
  connection: z.enum([
    "connected",
    "connecting",
    "reconnecting",
    "disconnected",
    "unknown"
  ]),
  freshness: z.enum(["fresh", "syncing", "stale", "unknown"]),
  lastSyncedAt: z.string().nullable()
});

export type ConversationSyncState = z.infer<typeof conversationSyncStateSchema>;

export const conversationViewSchema = z.object({
  thread: threadContextSchema,
  pageState: conversationPageStateSchema,
  timeline: z.array(timelineItemSchema),
  composer: composerViewSchema,
  notices: z.array(pageNoticeSchema),
  sync: conversationSyncStateSchema
});

export type ConversationView = z.infer<typeof conversationViewSchema>;

export const conversationViewResponseSchema = apiResponseSchema(
  conversationViewSchema
);

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
