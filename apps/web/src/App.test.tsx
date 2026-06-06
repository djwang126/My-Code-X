// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { ConversationSnapshotView, TranscriptEntry } from "@my-code-x/app-types";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

function emptySnapshot(conversationId: string): ConversationSnapshotView {
  return {
    conversation: {
      id: conversationId,
      contentRestore: { kind: "RestoredEmpty" }
    },
    transcriptEntries: [],
    turns: [],
    pendingInteractions: [],
    cursor: "0"
  };
}

function snapshotWithEntries(
  conversationId: string,
  transcriptEntries: TranscriptEntry[]
): ConversationSnapshotView {
  return {
    ...emptySnapshot(conversationId),
    conversation: {
      id: conversationId,
      contentRestore: { kind: "Restored" }
    },
    transcriptEntries,
    cursor: "2"
  };
}

function createIdleConversationViewClient() {
  return {
    getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
    sendInput: async () => ({ outcome: "Accepted" as const }),
    createEventSource: () => ({
      addEventListener: () => undefined,
      close: () => undefined
    })
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createControlledEventSource() {
  const listeners = new Map<string, (event: MessageEvent<string>) => void>();

  return {
    source: {
      addEventListener: (type: string, listener: (event: MessageEvent<string>) => void) => {
        listeners.set(type, listener);
      },
      close: () => undefined
    },
    emit: (type: string, data: unknown) => {
      const listener = listeners.get(type);

      if (listener === undefined) {
        throw new Error(`No listener registered for ${type}`);
      }

      act(() => {
        listener(new MessageEvent(type, { data: JSON.stringify(data) }));
      });
    }
  };
}

describe("Conversation View shell", () => {
  it("shows the no selected conversation state", () => {
    render(
      <App
        selectedConversation={null}
        conversationViewClient={createIdleConversationViewClient()}
      />
    );

    expect(screen.getByText("打开一个 Codex Thread")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "输入" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送不可用" })).toBeDisabled();
  });

  it("shows the selected conversation context and loads its snapshot", async () => {
    const requestedConversationIds: string[] = [];
    const conversationViewClient = {
      getSnapshot: async (conversationId: string) => {
        requestedConversationIds.push(conversationId);
        return emptySnapshot(conversationId);
      },
      sendInput: async () => ({ outcome: "Accepted" as const }),
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    };

    render(
      <App
        selectedConversation={{
          id: "conv-empty",
          title: "New Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={conversationViewClient}
      />
    );

    expect(screen.getByRole("heading", { name: "New Thread" })).toBeInTheDocument();
    expect(screen.getByText("D:\\workspaces\\AI-Tools\\My-Code-X-C")).toBeInTheDocument();
    await screen.findByLabelText("Conversation transcript");
    expect(requestedConversationIds).toEqual(["conv-empty"]);
  });

  it("renders ordinary user input and completed agent reply from the snapshot", async () => {
    render(
      <App
        selectedConversation={{
          id: "conv-seeded",
          title: "Seeded Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) =>
            snapshotWithEntries(conversationId, [
              {
                id: "entry-1-user",
                sequence: 1,
                body: { kind: "UserInput", markdown: "hello" }
              },
              {
                id: "entry-2-agent",
                sequence: 2,
                body: {
                  kind: "AgentReply",
                  content: "echo: hello",
                  stream: "Completed"
                }
              }
            ]),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByText("echo: hello")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /展开/ })).not.toBeInTheDocument();
  });

  it("opens conversation events after loading the snapshot cursor", async () => {
    const eventSourceInputs: Array<{ conversationId: string; cursor: string }> = [];

    render(
      <App
        selectedConversation={{
          id: "conv-events",
          title: "Live Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => ({
            ...emptySnapshot(conversationId),
            cursor: "cursor-42"
          }),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: (input) => {
            eventSourceInputs.push(input);

            return {
              addEventListener: () => undefined,
              close: () => undefined
            };
          }
        }}
      />
    );

    await screen.findByLabelText("Conversation transcript");
    expect(eventSourceInputs).toEqual([{ conversationId: "conv-events", cursor: "cursor-42" }]);
  });

  it("does not show the previous conversation transcript while the next snapshot is loading", async () => {
    const nextSnapshot = createDeferred<ConversationSnapshotView>();
    const conversationViewClient = {
      getSnapshot: (conversationId: string) => {
        if (conversationId === "conv-a") {
          return Promise.resolve(
            snapshotWithEntries(conversationId, [
              {
                id: "entry-a-user",
                sequence: 1,
                body: { kind: "UserInput", markdown: "hello-a" }
              }
            ])
          );
        }

        return nextSnapshot.promise;
      },
      sendInput: async () => ({ outcome: "Accepted" as const }),
      createEventSource: () => ({
        addEventListener: () => undefined,
        close: () => undefined
      })
    };

    const { rerender } = render(
      <App
        selectedConversation={{
          id: "conv-a",
          title: "Thread A",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={conversationViewClient}
      />
    );

    expect(await screen.findByText("hello-a")).toBeInTheDocument();

    rerender(
      <App
        selectedConversation={{
          id: "conv-b",
          title: "Thread B",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={conversationViewClient}
      />
    );

    expect(screen.getByRole("heading", { name: "Thread B" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("hello-a")).not.toBeInTheDocument();
    });

    await act(async () => {
      nextSnapshot.resolve(
        snapshotWithEntries("conv-b", [
          {
            id: "entry-b-user",
            sequence: 1,
            body: { kind: "UserInput", markdown: "hello-b" }
          }
        ])
      );
    });

    expect(await screen.findByText("hello-b")).toBeInTheDocument();
    expect(screen.queryByText("hello-a")).not.toBeInTheDocument();
  });

  it("sends normal input while idle", async () => {
    const sentInputs: Array<{ conversationId: string; markdownSource: string }> = [];

    render(
      <App
        selectedConversation={{
          id: "conv-send",
          title: "Send Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async (input) => {
            sentInputs.push(input);
            return { outcome: "Accepted" as const };
          },
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    await screen.findByLabelText("Conversation transcript");
    fireEvent.change(screen.getByRole("textbox", { name: "输入" }), {
      target: { value: "hello" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(sentInputs).toEqual([{ conversationId: "conv-send", markdownSource: "hello" }]);
    });
  });

  it("does not alter UTF-8 CJK emoji input when sending", async () => {
    const sentInputs: Array<{ conversationId: string; markdownSource: string }> = [];
    const originalInput = "你好 Codex 👋\n第二行";

    render(
      <App
        selectedConversation={{
          id: "conv-utf8",
          title: "UTF-8 Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async (input) => {
            sentInputs.push(input);
            return { outcome: "Accepted" as const };
          },
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    await screen.findByLabelText("Conversation transcript");
    fireEvent.change(screen.getByRole("textbox", { name: "输入" }), {
      target: { value: originalInput }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(sentInputs).toEqual([
        { conversationId: "conv-utf8", markdownSource: originalInput }
      ]);
    });
  });

  it("disables duplicate send while waiting for the send result", async () => {
    const sendResult = createDeferred<{ outcome: "Accepted" }>();
    const sentInputs: Array<{ conversationId: string; markdownSource: string }> = [];

    render(
      <App
        selectedConversation={{
          id: "conv-waiting",
          title: "Waiting Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: (input) => {
            sentInputs.push(input);
            return sendResult.promise;
          },
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    await screen.findByLabelText("Conversation transcript");
    fireEvent.change(screen.getByRole("textbox", { name: "输入" }), {
      target: { value: "hello" }
    });
    const sendButton = screen.getByRole("button", { name: "发送" });

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendButton).toBeDisabled();
    });
    fireEvent.click(sendButton);
    expect(sentInputs).toEqual([{ conversationId: "conv-waiting", markdownSource: "hello" }]);
  });

  it("clears the current draft after the send request is accepted", async () => {
    render(
      <App
        selectedConversation={{
          id: "conv-clear",
          title: "Clear Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    await screen.findByLabelText("Conversation transcript");
    const textbox = screen.getByRole("textbox", { name: "输入" });
    fireEvent.change(textbox, {
      target: { value: "hello" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(textbox).toHaveValue("");
    });
  });

  it("does not add the local draft as formal transcript content after accepted", async () => {
    render(
      <App
        selectedConversation={{
          id: "conv-no-local-entry",
          title: "No Local Entry Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: () => ({
            addEventListener: () => undefined,
            close: () => undefined
          })
        }}
      />
    );

    const transcript = await screen.findByLabelText("Conversation transcript");
    const textbox = screen.getByRole("textbox", { name: "输入" });
    fireEvent.change(textbox, {
      target: { value: "hello" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(textbox).toHaveValue("");
    });
    expect(within(transcript).queryByText("hello")).not.toBeInTheDocument();
  });

  it("appends transcript entry added user input events", async () => {
    const eventSource = createControlledEventSource();

    render(
      <App
        selectedConversation={{
          id: "conv-live-user",
          title: "Live User Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: () => eventSource.source
        }}
      />
    );

    const transcript = await screen.findByLabelText("Conversation transcript");

    eventSource.emit("transcript.entry-added", {
      entry: {
        id: "entry-1-user",
        sequence: 1,
        body: { kind: "UserInput", markdown: "hello from live event" }
      }
    });

    expect(within(transcript).getByText("hello from live event")).toBeInTheDocument();
  });

  it("appends transcript entry added completed agent reply events", async () => {
    const eventSource = createControlledEventSource();

    render(
      <App
        selectedConversation={{
          id: "conv-live-agent",
          title: "Live Agent Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async () => ({ outcome: "Accepted" as const }),
          createEventSource: () => eventSource.source
        }}
      />
    );

    const transcript = await screen.findByLabelText("Conversation transcript");

    eventSource.emit("transcript.entry-added", {
      entry: {
        id: "entry-2-agent",
        sequence: 2,
        body: {
          kind: "AgentReply",
          content: "echo from live event",
          stream: "Completed"
        }
      }
    });

    expect(within(transcript).getByText("echo from live event")).toBeInTheDocument();
    expect(within(transcript).queryByRole("button", { name: /展开/ })).not.toBeInTheDocument();
  });

  it("shows the echo at the bottom after send and SSE return", async () => {
    const eventSource = createControlledEventSource();
    const sentInputs: Array<{ conversationId: string; markdownSource: string }> = [];

    render(
      <App
        selectedConversation={{
          id: "conv-live-echo",
          title: "Live Echo Thread",
          directory: "D:\\workspaces\\AI-Tools\\My-Code-X-C"
        }}
        conversationViewClient={{
          getSnapshot: async (conversationId: string) => emptySnapshot(conversationId),
          sendInput: async (input) => {
            sentInputs.push(input);
            return { outcome: "Accepted" as const };
          },
          createEventSource: () => eventSource.source
        }}
      />
    );

    const transcript = await screen.findByLabelText("Conversation transcript");
    const textbox = screen.getByRole("textbox", { name: "输入" });
    fireEvent.change(textbox, {
      target: { value: "hello" }
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(textbox).toHaveValue("");
    });
    expect(sentInputs).toEqual([
      { conversationId: "conv-live-echo", markdownSource: "hello" }
    ]);

    eventSource.emit("transcript.entry-added", {
      entry: {
        id: "entry-1-user",
        sequence: 1,
        body: { kind: "UserInput", markdown: "hello" }
      }
    });
    eventSource.emit("transcript.entry-added", {
      entry: {
        id: "entry-2-agent",
        sequence: 2,
        body: {
          kind: "AgentReply",
          content: "echo: hello",
          stream: "Completed"
        }
      }
    });

    const transcriptItems = within(transcript).getAllByRole("listitem");
    expect(transcriptItems).toHaveLength(2);
    const latestTranscriptItem = transcriptItems.at(-1);

    if (latestTranscriptItem === undefined) {
      throw new Error("Expected the transcript to contain the echoed reply");
    }

    expect(within(transcript).getByText("hello")).toBeInTheDocument();
    expect(within(latestTranscriptItem).getByText("echo: hello")).toBeInTheDocument();
  });
});
