import {
  conversationSnapshotViewSchema,
  inputSendOutcomeSchema
} from "@my-code-x/app-types";
import type {
  ConversationSnapshotView,
  InputSendOutcome
} from "@my-code-x/app-types";

export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface SendConversationInput {
  conversationId: string;
  markdownSource: string;
}

export interface CreateConversationEventSourceInput {
  conversationId: string;
  cursor: string;
}

export interface ConversationViewClient {
  getSnapshot(conversationId: string): Promise<ConversationSnapshotView>;
  sendInput(input: SendConversationInput): Promise<InputSendOutcome>;
  createEventSource(input: CreateConversationEventSourceInput): EventSourceLike;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type EventSourceFactory = (url: string) => EventSourceLike;

export interface CreateConversationViewClientInput {
  fetch?: FetchLike;
  createEventSource?: EventSourceFactory;
}

function defaultFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

function defaultCreateEventSource(url: string): EventSourceLike {
  return new EventSource(url);
}

export function createConversationViewClient(
  input: CreateConversationViewClientInput = {}
): ConversationViewClient {
  const fetchJson = input.fetch ?? defaultFetch;
  const createEventSource = input.createEventSource ?? defaultCreateEventSource;

  return {
    async getSnapshot(conversationId) {
      const response = await fetchJson(
        `/api/conversations/${encodeURIComponent(conversationId)}/snapshot`
      );

      if (!response.ok) {
        throw new Error("Conversation snapshot unavailable");
      }

      const body = await response.json();

      return conversationSnapshotViewSchema.parse(body);
    },

    async sendInput(input) {
      const response = await fetchJson(
        `/api/conversations/${encodeURIComponent(input.conversationId)}/inputs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdownSource: input.markdownSource })
        }
      );

      if (!response.ok) {
        throw new Error("Conversation input was not accepted");
      }

      const body = await response.json();

      return inputSendOutcomeSchema.parse(body);
    },

    createEventSource(input) {
      const params = new URLSearchParams({
        after: input.cursor
      });

      return createEventSource(
        `/api/conversations/${encodeURIComponent(input.conversationId)}/events?${params}`
      );
    }
  };
}

export const DEFAULT_CONVERSATION_VIEW_CLIENT = createConversationViewClient();
