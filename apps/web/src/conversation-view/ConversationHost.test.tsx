import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  ConversationHostView,
  ConversationPageState,
  TimelineItem
} from "@my-code-x/app-types";
import { ConversationHost } from "./ConversationHost";

describe("ConversationHost message timeline", () => {
  test("shows restored message timeline instead of empty state", () => {
    const html = renderHost([
      messageItem({
        id: "item-user",
        role: "user",
        text: "请解释这个 TypeScript 错误"
      }),
      messageItem({
        id: "item-agent",
        role: "agent",
        text: "这个错误表示类型不兼容。"
      })
    ]);

    expect(html).toContain("请解释这个 TypeScript 错误");
    expect(html).toContain("这个错误表示类型不兼容。");
    expect(html).not.toContain("暂无可展示内容");
  });

  test("keeps the server timeline order", () => {
    const html = renderHost([
      messageItem({
        id: "item-user",
        occurredAt: "2026-05-21T10:00:00.000Z",
        role: "user",
        text: "数组中的第一条"
      }),
      messageItem({
        id: "item-agent",
        occurredAt: "2026-05-21T09:00:00.000Z",
        role: "agent",
        text: "数组中的第二条"
      })
    ]);

    expect(html.indexOf("数组中的第一条")).toBeLessThan(
      html.indexOf("数组中的第二条")
    );
  });

  test("distinguishes user messages from Codex messages", () => {
    const html = renderHost([
      messageItem({
        id: "item-user",
        role: "user",
        text: "用户消息正文"
      }),
      messageItem({
        id: "item-agent",
        role: "agent",
        text: "Codex 消息正文"
      })
    ]);

    expect(html).toContain('aria-label="用户消息"');
    expect(html).toContain('aria-label="Codex 消息"');
    expect(html).toContain(
      'class="transcript-row message-row user-message-row"'
    );
    expect(html).toContain('class="message-text message-text--user"');
    expect(html).not.toContain("message-item");
  });

  test("does not add invented copy to message bodies", () => {
    const html = renderHost([
      messageItem({
        id: "item-user",
        role: "user",
        text: "只展示原始用户输入"
      }),
      messageItem({
        id: "item-agent",
        role: "agent",
        text: "只展示原始 Codex 回复"
      })
    ]);

    expect(html).toContain(">只展示原始用户输入</p>");
    expect(html).toContain(">只展示原始 Codex 回复</p>");
    expect(html).not.toContain("用户说");
    expect(html).not.toContain("Codex 回复：");
  });

  test("keeps readable messages when content is stale", () => {
    const html = renderHost(
      [
        messageItem({
          id: "item-agent",
          role: "agent",
          text: "旧内容仍然可读"
        })
      ],
      {
        pageState: {
          kind: "stale",
          message: "内容可能不是最新"
        }
      }
    );

    expect(html).toContain("旧内容仍然可读");
  });

  test("keeps readable messages while restoring when readable content exists", () => {
    const html = renderHost(
      [
        messageItem({
          id: "item-user",
          role: "user",
          text: "恢复期间保留的输入"
        })
      ],
      {
        pageState: {
          kind: "restoring",
          hasReadableContent: true
        }
      }
    );

    expect(html).toContain("恢复期间保留的输入");
  });

  test("shows restoring state when restoring has no readable content", () => {
    const html = renderHost([], {
      pageState: {
        kind: "restoring",
        hasReadableContent: false
      }
    });

    expect(html).toContain("正在恢复内容");
    expect(html).not.toContain('aria-label="Timeline"');
  });
});

function renderHost(
  timeline: TimelineItem[],
  options?: { pageState?: ConversationPageState }
): string {
  const conversationHost = conversationHostWithTimeline(timeline, options);

  return renderToStaticMarkup(
    <ConversationHost
      state={{
        status: "ready",
        conversationHost
      }}
    />
  );
}

function conversationHostWithTimeline(
  timeline: TimelineItem[],
  options?: { pageState?: ConversationPageState }
): ConversationHostView {
  return {
    kind: "conversationTargetSelected",
    threadId: "thread-1",
    conversation: {
      thread: {
        threadId: "thread-1",
        title: "Restore message history",
        cwd: "D:\\workspaces\\AI-Tools\\My-Code-X-C",
        updatedAt: "2026-05-21T10:00:00.000Z",
        status: "idle"
      },
      pageState: options?.pageState ?? { kind: "ready" },
      timeline,
      composer: {
        threadId: "thread-1",
        draft: "",
        action: {
          kind: "disabled",
          enabled: false,
          reason: "emptyDraft"
        }
      },
      notices: [],
      sync: {
        connection: "connected",
        freshness: "fresh",
        lastSyncedAt: "2026-05-21T10:00:00.000Z"
      }
    }
  };
}

function messageItem(input: {
  id: string;
  occurredAt?: string;
  role: "user" | "agent";
  text: string;
}): TimelineItem {
  return {
    id: input.id,
    turnId: "turn-1",
    occurredAt: input.occurredAt ?? null,
    status: "completed",
    kind: "message",
    message: {
      role: input.role,
      text: input.text,
      markdown: input.role === "agent",
      copyText: input.text
    }
  };
}
