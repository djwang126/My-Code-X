import { useEffect, useState } from "react";
import type { HealthView } from "@my-code-x/app-types";

export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface AppDependencies {
  fetchHealth?: () => Promise<HealthView>;
  createEventSource?: (url: string) => EventSourceLike;
}

type ServerStatus = "checking" | "connected" | "disconnected";
type SseStatus = "waiting" | "ready";

function isWalkingSkeletonReadyPayload(data: string): boolean {
  const parsed = JSON.parse(data) as unknown;

  return (
    typeof parsed === "object" &&
    parsed !== null &&
    "status" in parsed &&
    parsed.status === "ready"
  );
}

async function defaultFetchHealth(): Promise<HealthView> {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error("Health check failed");
  }

  const body = (await response.json()) as HealthView;

  if (body.status !== "ok") {
    throw new Error("Unexpected health response");
  }

  return body;
}

function defaultCreateEventSource(url: string): EventSourceLike {
  return new EventSource(url);
}

export function App(input: AppDependencies = {}) {
  const fetchHealth = input.fetchHealth ?? defaultFetchHealth;
  const createEventSource = input.createEventSource ?? defaultCreateEventSource;
  const [serverStatus, setServerStatus] = useState<ServerStatus>("checking");
  const [sseStatus, setSseStatus] = useState<SseStatus>("waiting");

  useEffect(() => {
    let active = true;

    fetchHealth()
      .then(() => {
        if (active) {
          setServerStatus("connected");
        }
      })
      .catch(() => {
        if (active) {
          setServerStatus("disconnected");
        }
      });

    const events = createEventSource("/api/walking-skeleton/events");
    events.addEventListener("walking-skeleton.ready", (event) => {
      try {
        if (!isWalkingSkeletonReadyPayload(event.data)) {
          return;
        }
      } catch {
        return;
      }

      if (active) {
        setSseStatus("ready");
      }
    });

    return () => {
      active = false;
      events.close();
    };
  }, [createEventSource, fetchHealth]);

  return (
    <main className="app-shell">
      <div className="empty-state">
        <h1>My-Code-X</h1>
        <p>Conversation View pending implementation.</p>
        <dl className="skeleton-status">
          <div>
            <dt>Server</dt>
            <dd>
              {serverStatus === "checking" && "Server checking"}
              {serverStatus === "connected" && "Server connected"}
              {serverStatus === "disconnected" && "Server disconnected"}
            </dd>
          </div>
          <div>
            <dt>SSE</dt>
            <dd>{sseStatus === "ready" ? "SSE ready" : "SSE waiting"}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
