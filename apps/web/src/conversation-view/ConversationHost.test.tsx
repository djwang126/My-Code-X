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

  test("renders one timeline list item per restored message", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        role: "user",
        text: "第一条消息"
      }),
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "第二条消息"
      })
    ]);

    expect(html.match(/<li class="/g)).toHaveLength(2);
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
    expect(html).toContain(
      'class="transcript-row message-row user-message-row"'
    );
    expect(html).toContain('class="message-text message-text--user"');
    expect(html).toContain('aria-label="User message toolbar"');
    expect(html).toContain('aria-label="Codex message toolbar"');
    expect(html).not.toContain("message-item");
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
    expect(html).not.toContain(">复制用户消息</p>");
    expect(html).not.toContain(">复制 Codex 消息</p>");
    expect(html).not.toContain("用户说");
    expect(html).not.toContain("Codex 回复：");
  });

  test("renders markdown messages as readable rich text", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Review **important** items:\n\n- tests\n- styles"
      })
    ]);

    expect(html).toContain("<strong>important</strong>");
    expect(html).toContain("<li>tests</li>");
    expect(html).toContain("<li>styles</li>");
    expect(html).not.toContain("**important**");
  });

  test("keeps plain text messages unparsed when markdown is disabled", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        markdown: false,
        role: "user",
        text: "Do not parse **this** [link](https://example.com)"
      })
    ]);

    expect(html).toContain("Do not parse **this** [link](https://example.com)");
    expect(html).not.toContain("<strong>this</strong>");
    expect(html).not.toContain('href="https://example.com"');
  });

  test("renders fenced code blocks in a narrow-screen scroll container", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Use this:\n\n```ts\nconst value = 1;\n```"
      })
    ]);

    expect(html).toContain('class="code-block-wrap"');
    expect(html).toContain('class="code-block"');
    expect(html).toContain("const value = 1;");
    expect(html).not.toContain("```ts");
  });

  test("renders markdown tables in a horizontal scroll region", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: [
          "| Item | Status |",
          "| --- | --- |",
          "| links | ok |",
          "| wide table | scroll |"
        ].join("\n")
      })
    ]);

    expect(html).toContain('class="table-scroll"');
    expect(html).toContain('class="markdown-table"');
    expect(html).toContain("<th>Item</th>");
    expect(html).toContain("<td>wide table</td>");
  });

  test("renders markdown links as safe clickable anchors", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Read the [streaming docs](https://example.com/docs)."
      })
    ]);

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain(">streaming docs</a>");
  });

  test("does not render markdown images as external image requests", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Inspect ![diagram](https://example.com/diagram.png)"
      })
    ]);

    expect(html).not.toContain('src="https://example.com/diagram.png"');
    expect(html).not.toContain('href="https://example.com/diagram.png"');
    expect(html).toContain("[image: diagram]");
  });

  test("does not inject raw markdown HTML into message output", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Before\n\n<script>alert('x')</script>\n\nAfter"
      })
    ]);

    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).not.toContain("<script>");
  });

  test("renders markdown headings without introducing heading layout", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "# Release notes"
      })
    ]);

    expect(html).toContain("<p>Release notes</p>");
    expect(html).not.toContain("<h1");
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
