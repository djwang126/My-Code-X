import { get } from "node:http";
import { expect } from "vitest";

export interface ParsedSseEvent {
  event: string;
  id: string;
  data: unknown;
}

export interface SseCollector {
  opened: Promise<void>;
  events: Promise<ParsedSseEvent[]>;
  close(): void;
}

function parseSseFrame(frame: string): ParsedSseEvent {
  const eventLine = frame.split("\n").find((line) => line.startsWith("event: "));
  const idLine = frame.split("\n").find((line) => line.startsWith("id: "));
  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));

  if (eventLine === undefined || idLine === undefined || dataLine === undefined) {
    throw new Error(`Malformed SSE frame: ${frame}`);
  }

  return {
    event: eventLine.slice("event: ".length),
    id: idLine.slice("id: ".length),
    data: JSON.parse(dataLine.slice("data: ".length)) as unknown
  };
}

function takeCompletedSseEvents(buffer: string): { events: ParsedSseEvent[]; remaining: string } {
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() ?? "";

  return {
    events: parts.filter((part) => part.length > 0).map(parseSseFrame),
    remaining
  };
}

export function openSseCollector(url: string, expectedCount: number): SseCollector {
  let openedResolve!: () => void;
  let openedReject!: (error: unknown) => void;
  const opened = new Promise<void>((resolve, reject) => {
    openedResolve = resolve;
    openedReject = reject;
  });

  let eventsResolve!: (events: ParsedSseEvent[]) => void;
  let eventsReject!: (error: unknown) => void;
  const events = new Promise<ParsedSseEvent[]>((resolve, reject) => {
    eventsResolve = resolve;
    eventsReject = reject;
  });

  let settled = false;
  let buffer = "";
  const collected: ParsedSseEvent[] = [];

  const clientRequest = get(url, (response) => {
    try {
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      openedResolve();
    } catch (error) {
      settled = true;
      openedReject(error);
      eventsReject(error);
      clientRequest.destroy();
      return;
    }

    response.on("data", (chunk: Buffer) => {
      try {
        buffer += chunk.toString("utf8");
        const parsed = takeCompletedSseEvents(buffer);
        buffer = parsed.remaining;
        collected.push(...parsed.events);

        if (collected.length !== expectedCount) {
          return;
        }

        settled = true;
        eventsResolve(collected);
        clientRequest.destroy();
      } catch (error) {
        settled = true;
        eventsReject(error);
        clientRequest.destroy();
      }
    });
  });

  clientRequest.on("error", (error: NodeJS.ErrnoException) => {
    if (settled && error.code === "ECONNRESET") {
      return;
    }

    openedReject(error);
    eventsReject(error);
  });

  return {
    opened,
    events,
    close() {
      settled = true;
      clientRequest.destroy();
    }
  };
}

export function openNoEventGuard(url: string, unexpectedEventMessage: string) {
  let openedResolve!: () => void;
  let openedReject!: (error: unknown) => void;
  const opened = new Promise<void>((resolve, reject) => {
    openedResolve = resolve;
    openedReject = reject;
  });

  let unexpectedEventReject!: (error: unknown) => void;
  const unexpectedEvent = new Promise<never>((_resolve, reject) => {
    unexpectedEventReject = reject;
  });

  let buffer = "";
  const clientRequest = get(url, (response) => {
    try {
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      openedResolve();
    } catch (error) {
      openedReject(error);
      clientRequest.destroy();
      return;
    }

    response.on("data", (chunk: Buffer) => {
      try {
        buffer += chunk.toString("utf8");
        const parsed = takeCompletedSseEvents(buffer);
        buffer = parsed.remaining;

        for (const event of parsed.events) {
          unexpectedEventReject(new Error(`${unexpectedEventMessage}: ${event.event}`));
        }
      } catch (error) {
        unexpectedEventReject(error);
        clientRequest.destroy();
      }
    });
  });

  clientRequest.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "ECONNRESET") {
      return;
    }

    openedReject(error);
  });

  return {
    opened,
    unexpectedEvent,
    close() {
      clientRequest.destroy();
    }
  };
}

export function expectedEntryAddedEvents(markdownSource: string): ParsedSseEvent[] {
  return [
    {
      event: "transcript.entry-added",
      id: "1",
      data: {
        entry: {
          id: "entry-1-user",
          sequence: 1,
          body: {
            kind: "UserInput",
            markdown: markdownSource
          }
        }
      }
    },
    {
      event: "transcript.entry-added",
      id: "2",
      data: {
        entry: {
          id: "entry-2-agent",
          sequence: 2,
          body: {
            kind: "AgentReply",
            content: `echo: ${markdownSource}`,
            stream: "Completed"
          }
        }
      }
    }
  ];
}
