// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

function createIdleEventSource() {
  return {
    addEventListener: () => undefined,
    close: () => undefined
  };
}

describe("App walking skeleton", () => {
  it("keeps the Conversation View placeholder visible", () => {
    render(
      <App
        fetchHealth={async () => ({ status: "ok" })}
        createEventSource={createIdleEventSource}
      />
    );

    expect(screen.getByText("Conversation View pending implementation.")).toBeInTheDocument();
  });

  it("shows the server as connected when health succeeds", async () => {
    render(
      <App
        fetchHealth={async () => ({ status: "ok" })}
        createEventSource={createIdleEventSource}
      />
    );

    expect(await screen.findByText("Server connected")).toBeInTheDocument();
  });

  it("shows the server as disconnected when health fails", async () => {
    render(
      <App
        fetchHealth={async () => {
          throw new Error("health unavailable");
        }}
        createEventSource={createIdleEventSource}
      />
    );

    expect(await screen.findByText("Server disconnected")).toBeInTheDocument();
  });

  it("shows SSE as waiting before the ready event arrives", () => {
    render(
      <App
        fetchHealth={async () => ({ status: "ok" })}
        createEventSource={createIdleEventSource}
      />
    );

    expect(screen.getByText("SSE waiting")).toBeInTheDocument();
  });

  it("shows SSE as ready after receiving the walking skeleton ready event", () => {
    let readyListener: ((event: MessageEvent<string>) => void) | undefined;

    render(
      <App
        fetchHealth={async () => ({ status: "ok" })}
        createEventSource={(url) => {
          expect(url).toBe("/api/walking-skeleton/events");

          return {
            addEventListener: (type, listener) => {
              if (type === "walking-skeleton.ready") {
                readyListener = listener;
              }
            },
            close: () => undefined
          };
        }}
      />
    );

    expect(readyListener).not.toBeUndefined();

    act(() => {
      readyListener?.(new MessageEvent("walking-skeleton.ready", { data: '{"status":"ready"}' }));
    });

    expect(screen.getByText("SSE ready")).toBeInTheDocument();
  });

  it("keeps SSE waiting when the walking skeleton ready event has an invalid payload", () => {
    let readyListener: ((event: MessageEvent<string>) => void) | undefined;

    render(
      <App
        fetchHealth={async () => ({ status: "ok" })}
        createEventSource={() => ({
          addEventListener: (type, listener) => {
            if (type === "walking-skeleton.ready") {
              readyListener = listener;
            }
          },
          close: () => undefined
        })}
      />
    );

    expect(readyListener).not.toBeUndefined();

    act(() => {
      readyListener?.(new MessageEvent("walking-skeleton.ready", { data: '{"status":"stale"}' }));
    });

    expect(screen.getByText("SSE waiting")).toBeInTheDocument();
  });
});
