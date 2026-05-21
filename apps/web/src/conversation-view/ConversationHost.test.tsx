import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  ConversationPageState,
  TimelineItem
} from "@my-code-x/app-types";
import {
  conversationHostWithTimelineFixture,
  messageTimelineItemFixture,
  workProgressTimelineItemFixture
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

describe("ConversationHost work progress timeline", () => {
  test("shows restored work progress timeline instead of empty state", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "commandExecution",
        label: "运行测试",
        summary: "pnpm test 已启动"
      })
    ]);

    expect(html).toContain("运行测试");
    expect(html).toContain("pnpm test 已启动");
    expect(html).not.toContain("暂无可展示内容");
  });

  test("keeps mixed message and work progress in server order", () => {
    const html = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        role: "user",
        text: "先提出需求"
      }),
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "commandExecution",
        label: "再运行命令",
        summary: "pnpm test"
      }),
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "最后给出结果"
      })
    ]);

    expect(html.indexOf("先提出需求")).toBeLessThan(
      html.indexOf("再运行命令")
    );
    expect(html.indexOf("再运行命令")).toBeLessThan(
      html.indexOf("最后给出结果")
    );
  });

  test("shows compact source and status for work progress", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "commandExecution",
        label: "执行命令",
        summary: "pnpm test",
        status: "completed"
      })
    ]);

    expect(html).toContain("commandExecution");
    expect(html).toContain("完成");
    expect(html).toContain("执行命令");
    expect(html).toContain("pnpm test");
  });

  test("keeps work progress readable when summary is absent", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "fileChange",
        label: "更新文件",
        summary: null,
        status: "inProgress"
      })
    ]);

    expect(html).toContain("fileChange");
    expect(html).toContain("更新文件");
    expect(html).toContain("进行中");
    expect(html).not.toContain(">null<");
  });

  test("shows work progress detail fields in an expandable region", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "commandExecution",
        label: "执行命令",
        summary: "pnpm test",
        fields: [
          {
            key: "cwd",
            label: "工作目录",
            value: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
          },
          {
            key: "command",
            label: "命令",
            value: "pnpm test"
          }
        ]
      })
    ]);

    expect(html).toContain("<summary>查看详情</summary>");
    expect(html).toContain("工作目录");
    expect(html).toContain("D:\\workspaces\\AI-Tools\\My-Code-X-C");
    expect(html).toContain("命令");
    expect(html).toContain("pnpm test");
  });

  test("renders work progress detail values as plain text", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
        sourceType: "mcpToolCall",
        label: "调用工具",
        summary: "读取资源",
        fields: [
          {
            key: "unsafe",
            label: "原始内容",
            value: "<script>alert('x')</script> [docs](https://example.com)"
          }
        ]
      })
    ]);

    expect(html).toContain("&lt;script&gt;alert(&#x27;x&#x27;)&lt;/script&gt;");
    expect(html).toContain("[docs](https://example.com)");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="https://example.com"');
  });

  test("uses the same generic presentation for different work progress sources", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-command",
        sourceType: "commandExecution",
        label: "执行命令",
        summary: "pnpm test"
      }),
      workProgressTimelineItemFixture({
        id: "item-tool",
        sourceType: "mcpToolCall",
        label: "调用 MCP 工具",
        summary: "读取资源"
      })
    ]);

    expect(html.match(/aria-label="Work progress item"/g)).toHaveLength(2);
    expect(html).not.toContain("command-execution-item");
    expect(html).not.toContain("mcp-tool-call-item");
  });

  test("does not turn work progress details into extra timeline entries", () => {
    const html = renderHost([
      workProgressTimelineItemFixture({
        id: "item-command",
        sourceType: "commandExecution",
        label: "执行命令",
        summary: "pnpm test",
        fields: [
          {
            key: "command",
            label: "命令",
            value: "pnpm test"
          }
        ]
      }),
      workProgressTimelineItemFixture({
        id: "item-file",
        sourceType: "fileChange",
        label: "修改文件",
        summary: "更新 ConversationTimeline.tsx",
        fields: [
          {
            key: "path",
            label: "路径",
            value: "apps/web/src/conversation-view/ConversationTimeline.tsx"
          }
        ]
      }),
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "完成"
      })
    ]);

    expect(html.match(/<li class="/g)).toHaveLength(3);
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
