import { z } from 'zod';
import { clientConversationViewSchema, type ClientConversationView } from '@my-code-x/contracts-new';
import type { AppScope } from './app-scope.js';

const clientSnapshotSchema = z.object({
  conversation: clientConversationViewSchema,
}).passthrough();

export interface ClientSnapshotApiBoundary {
  loadSnapshot(input: LoadClientSnapshotInput): Promise<ClientSnapshotResult>;
}

export interface LoadClientSnapshotInput {
  readonly scope: AppScope;
}

export interface ClientSnapshotResult {
  readonly conversation: ClientConversationView;
}

export function createClientSnapshotApiBoundary(): ClientSnapshotApiBoundary {
  return {
    async loadSnapshot(input: LoadClientSnapshotInput): Promise<ClientSnapshotResult> {
      return loadClientSnapshot(input);
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
