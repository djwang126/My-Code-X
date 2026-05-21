import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  ConversationPageState,
  TimelineItem
} from "@my-code-x/app-types";
import {
  conversationHostWithTimelineFixture,
  messageTimelineItemFixture
} from "../conversation-view-test-fixtures";
import { ConversationHost } from "./ConversationHost";

describe("ConversationHost message timeline", () => {
  test("shows restored message timeline instead of empty state", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        role: "user",
        text: "请解释这个 TypeScript 错误"
      }),
      messageTimelineItemFixture({
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
      messageTimelineItemFixture({
        id: "item-user",
        occurredAt: "2026-05-21T10:00:00.000Z",
        role: "user",
        text: "数组中的第一条"
      }),
      messageTimelineItemFixture({
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
      messageTimelineItemFixture({
        id: "item-user",
        role: "user",
        text: "用户消息正文"
      }),
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Codex 消息正文"
      })
    ]);

    expect(html).toContain('aria-label="用户消息"');
    expect(html).toContain('aria-label="Codex 消息"');
  });

  test("does not add invented copy to message bodies", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        role: "user",
        text: "只展示原始用户输入"
      }),
      messageTimelineItemFixture({
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
        messageTimelineItemFixture({
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
        messageTimelineItemFixture({
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
  const conversationHost = conversationHostWithTimelineFixture(timeline, options);

  return renderToStaticMarkup(
    <ConversationHost
      state={{
        status: "ready",
        conversationHost
      }}
    />
  );
}
