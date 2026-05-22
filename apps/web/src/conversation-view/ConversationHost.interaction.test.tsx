// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TimelineItem } from "@my-code-x/app-types";
import {
  conversationHostWithTimelineFixture,
  messageTimelineItemFixture,
  unknownTimelineItemFixture,
  workProgressTimelineItemFixture
} from "../conversation-view-test-fixtures";
import { ConversationHost } from "./ConversationHost";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ConversationHost message interactions", () => {
  afterEach(() => {
    resetClipboard();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("copies only the selected code block content", async () => {
    const writeText = stubClipboard();
    const view = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        role: "agent",
        text: "Use this:\n\n```ts\nconst value = 1;\n```\n\nThen continue."
      })
    ]);

    await click(getButtonByLabel(view.container, "复制代码块"));

    expect(writeText).toHaveBeenCalledWith("const value = 1;");
    expect(writeText).not.toHaveBeenCalledWith(
      "Use this:\n\n```ts\nconst value = 1;\n```\n\nThen continue."
    );
  });

  test("copies user message copy text from its toolbar", async () => {
    const writeText = stubClipboard();
    const view = renderHost([
      messageTimelineItemFixture({
        id: "item-user",
        copyText: "raw user input",
        role: "user",
        text: "**rendered** user input"
      })
    ]);

    await click(getButtonByLabel(view.container, "复制用户消息"));

    expect(writeText).toHaveBeenCalledWith("raw user input");
  });

  test("copies Codex message copy text from its toolbar", async () => {
    const writeText = stubClipboard();
    const view = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        copyText: "raw Codex reply",
        role: "agent",
        text: "**rendered** Codex reply"
      })
    ]);

    await click(getButtonByLabel(view.container, "复制 Codex 消息"));

    expect(writeText).toHaveBeenCalledWith("raw Codex reply");
  });

  test("does not fail when the browser clipboard is unavailable", async () => {
    resetClipboard();
    const view = renderHost([
      messageTimelineItemFixture({
        id: "item-agent",
        copyText: "copy me",
        role: "agent",
        text: "copy me"
      })
    ]);

    await expect(
      click(getButtonByLabel(view.container, "复制 Codex 消息"))
    ).resolves.toBeUndefined();
  });

  test("collapses and expands work progress details from the disclosure button", async () => {
    const view = renderHost([
      workProgressTimelineItemFixture({
        id: "item-work",
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
      })
    ]);

    expect(view.container.querySelector(".field-list")).not.toBeNull();
    expect(view.container.textContent).toContain("pnpm test");

    await click(getButtonByLabel(view.container, "收起工作痕迹详情"));

    expect(view.container.querySelector(".field-list")).toBeNull();
    expect(view.container.textContent).toContain("pnpm test");

    await click(getButtonByLabel(view.container, "展开工作痕迹详情"));

    expect(view.container.querySelector(".field-list")).not.toBeNull();
  });

  test("expands and collapses unknown item details from the disclosure button", async () => {
    const view = renderHost([
      unknownTimelineItemFixture({
        id: "item-unknown",
        sourceType: "session_shadow_event",
        statusLabel: "received",
        fields: [
          {
            key: "payload",
            label: "原始内容",
            value: "future payload"
          }
        ]
      })
    ]);

    expect(view.container.querySelector(".field-list")).toBeNull();
    expect(
      view.container.querySelector('article[aria-label="Collapsed unknown item"]')
    ).not.toBeNull();
    expect(view.container.textContent).toContain("session_shadow_event");
    expect(view.container.textContent).not.toContain("future payload");

    await click(getButtonByLabel(view.container, "展开未知条目详情"));

    expect(
      view.container.querySelector('article[aria-label="Expanded unknown item"]')
    ).not.toBeNull();
    expect(view.container.querySelector(".field-list")).not.toBeNull();
    expect(view.container.textContent).toContain("原始内容");
    expect(view.container.textContent).toContain("future payload");

    await click(getButtonByLabel(view.container, "收起未知条目详情"));

    expect(view.container.querySelector(".field-list")).toBeNull();
    expect(view.container.textContent).not.toContain("future payload");
  });
});

function renderHost(timeline: TimelineItem[]): RenderedHost {
  const conversationHost = conversationHostWithTimelineFixture(timeline);
  const container = document.createElement("div");
  const root = createRoot(container);
  document.body.append(container);

  act(() => {
    root.render(
      <ConversationHost
        state={{
          status: "ready",
          conversationHost
        }}
      />
    );
  });

  return {
    container,
    root
  };
}

interface RenderedHost {
  container: HTMLDivElement;
  root: Root;
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

function getButtonByLabel(
  container: HTMLElement,
  label: string
): HTMLButtonElement {
  const button = container.querySelector(`button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText
    }
  });

  return writeText;
}

function resetClipboard(): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined
  });
}
