import { clientEventSchema, clientSnapshotSchema, type ClientConversationView, type ClientEvent } from '@my-code-x/contracts-new';
import type { AppScope } from './app-scope.js';

export interface ClientSnapshotApiBoundary {
  loadSnapshot(input: LoadClientSnapshotInput): Promise<ClientSnapshotResult>;
  subscribeEvents(input: SubscribeClientEventsInput): ClientEventSubscription;
}

export interface LoadClientSnapshotInput {
  readonly scope: AppScope;
}

export interface ClientSnapshotResult {
  readonly conversation: ClientConversationView;
}

export interface SubscribeClientEventsInput {
  readonly scope: AppScope;
  receive(event: ClientEvent): void;
  fail(error: Error): void;
}

export interface ClientEventSubscription {
  close(): void;
}

export function createClientSnapshotApiBoundary(): ClientSnapshotApiBoundary {
  return {
    async loadSnapshot(input: LoadClientSnapshotInput): Promise<ClientSnapshotResult> {
      return loadClientSnapshot(input);
    },

    subscribeEvents(input: SubscribeClientEventsInput): ClientEventSubscription {
      return subscribeClientEvents(input);
    },
  };
}

async function loadClientSnapshot(input: LoadClientSnapshotInput): Promise<ClientSnapshotResult> {
  const response = await window.fetch('/client', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      kind: 'open-client',
      scope: {
        slotId: input.scope.slotId,
        workspaceId: input.scope.workspaceId,
        threadId: input.scope.threadId,
      },
      payload: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to load client snapshot: HTTP ${response.status}`);
  }

  const rawSnapshot: unknown = await response.json();
  const snapshot = clientSnapshotSchema.parse(rawSnapshot);

  return {
    conversation: snapshot.conversation,
  };
}

function subscribeClientEvents(input: SubscribeClientEventsInput): ClientEventSubscription {
  const source = new window.EventSource(createClientEventsUrl(input.scope));

  source.addEventListener('message', event => {
    const parsed = parseClientEventData(event.data);

    if (!parsed) {
      input.fail(new Error('Invalid client event payload'));
      return;
    }

    input.receive(parsed);
  });

  return {
    close() {
      source.close();
    },
  };
}

function createClientEventsUrl(scope: AppScope): string {
  const params = new URLSearchParams();
  appendNullableSearchParam({ params, name: 'slotId', value: scope.slotId });
  appendNullableSearchParam({ params, name: 'threadId', value: scope.threadId });
  return `/client/events?${params.toString()}`;
}

interface AppendNullableSearchParamInput {
  readonly params: URLSearchParams;
  readonly name: string;
  readonly value: string | null;
}

function appendNullableSearchParam(input: AppendNullableSearchParamInput): void {
  if (input.value === null) {
    return;
  }

  input.params.set(input.name, input.value);
}

function parseClientEventData(data: string): ClientEvent | null {
  let raw: unknown;

  try {
    raw = JSON.parse(data) as unknown;
  } catch {
    return null;
  }

  const parsed = clientEventSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}
