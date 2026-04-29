import type { ClientSnapshot } from '../contracts/index.js';
import type { ConversationSnapshot } from '../features/conversation/index.js';
import type { RuntimeRequestSnapshot } from '../features/runtime-request/index.js';
import type { SlotSelection } from '../features/slot/index.js';
import type { ThreadSnapshot } from '../features/thread/index.js';
import type { TurnSnapshot } from '../features/turn/index.js';
import type { WorkspaceSnapshot } from '../features/workspace/index.js';
import { presentConversation } from './conversation-presenter.js';
import { presentPendingInteractions } from './pending-interaction-presenter.js';
import { presentTurn } from './turn-presenter.js';

export interface CreateClientSnapshotInput {
  readonly revision: string;
  readonly slot: SlotSelection;
  readonly thread: ThreadSnapshot;
  readonly turn: TurnSnapshot;
  readonly conversation: ConversationSnapshot;
  readonly runtimeRequests: RuntimeRequestSnapshot;
  readonly workspace: WorkspaceSnapshot;
}

export function createClientSnapshot(input: CreateClientSnapshotInput): ClientSnapshot {
  const selectedThreadId = input.slot.threadId;
  const threadReady = Boolean(selectedThreadId && input.thread.currentThreadId === selectedThreadId);

  return {
    app: {
      status: 'ready',
    },
    identity: {
      slotId: input.slot.slotId,
    },
    selection: {
      workspaceId: input.slot.workspace,
      threadId: selectedThreadId,
    },
    workspace: {
      status: presentWorkspaceStatus(input),
    },
    thread: {
      status: threadReady ? 'ready' : 'none',
      title: null,
    },
    turn: presentTurn({ snapshot: input.turn }),
    conversation: {
      items: presentConversation({ snapshot: input.conversation }),
    },
    pendingInteractions: presentPendingInteractions({ snapshot: input.runtimeRequests }),
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: threadReady ? 'available' : 'disabled',
      revision: input.revision,
    },
  };
}

function presentWorkspaceStatus(input: CreateClientSnapshotInput): ClientSnapshot['workspace']['status'] {
  if (!input.slot.workspace) {
    return 'none';
  }

  return input.workspace.available ? 'selected' : 'unavailable';
}
