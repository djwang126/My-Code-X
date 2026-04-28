import type { ClientSnapshot } from '../contracts/index.js';
import type { ConversationSnapshot } from '../features/conversation/index.js';
import type { RuntimeRequestSnapshot } from '../features/runtime-request/index.js';
import type { SessionSnapshot } from '../features/session/index.js';
import type { ThreadSnapshot } from '../features/thread/index.js';
import type { TurnSnapshot } from '../features/turn/index.js';
import type { WorkspaceSnapshot } from '../features/workspace/index.js';
import { presentConversation } from './conversation-presenter.js';
import { presentPendingInteractions } from './pending-interaction-presenter.js';
import { presentTurn } from './turn-presenter.js';

export interface CreateClientSnapshotInput {
  readonly viewerId: string;
  readonly slotId: string;
  readonly revision: string;
  readonly session: SessionSnapshot;
  readonly thread: ThreadSnapshot;
  readonly turn: TurnSnapshot;
  readonly conversation: ConversationSnapshot;
  readonly runtimeRequests: RuntimeRequestSnapshot;
  readonly workspace: WorkspaceSnapshot;
}

export function createClientSnapshot(input: CreateClientSnapshotInput): ClientSnapshot {
  const threadId = input.thread.currentThreadId;

  return {
    app: {
      status: 'ready',
    },
    identity: {
      viewerId: input.viewerId,
      slotId: input.slotId,
    },
    selection: {
      workspaceId: input.workspace.workspace,
      threadId,
    },
    session: {
      status: input.session.lastError ? 'failed' : 'ready',
    },
    workspace: {
      status: input.workspace.workspace ? 'selected' : 'none',
    },
    thread: {
      status: threadId ? 'ready' : 'none',
      title: null,
    },
    turn: presentTurn({ snapshot: input.turn }),
    conversation: {
      items: presentConversation({ snapshot: input.conversation }),
    },
    pendingInteractions: presentPendingInteractions({ snapshot: input.runtimeRequests }),
    notices: input.session.lastNotice
      ? [
          {
            id: 'session-notice',
            level: 'info',
            title: 'Session notice',
            body: input.session.lastNotice,
          },
        ]
      : [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: threadId ? 'available' : 'disabled',
      revision: input.revision,
    },
  };
}
