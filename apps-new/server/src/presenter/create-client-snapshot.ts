import type { ClientConversationView, ClientSnapshot } from '@my-code-x/contracts-new';
import type { ConversationSnapshot } from '../features/conversation/index.js';
import type { SlotSelection } from '../features/slot/index.js';
import type { ThreadRecord } from '../features/thread/index.js';
import type { TurnSnapshot } from '../features/turn/index.js';
import type { WorkspaceSnapshot } from '../features/workspace/index.js';
import { presentConversation } from './conversation-presenter.js';
import { presentTurn } from './turn-presenter.js';

export interface CreateClientSnapshotInput {
  readonly revision: string;
  readonly slot: SlotSelection;
  readonly selectedThread: ThreadRecord | null;
  readonly turn: TurnSnapshot;
  readonly conversation: ConversationSnapshot;
  readonly conversationView?: ClientConversationView;
  readonly workspace: WorkspaceSnapshot;
}

export function createClientSnapshot(input: CreateClientSnapshotInput): ClientSnapshot {
  const selectedThreadId = input.slot.threadId;

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
    thread: presentThread(input),
    turn: presentTurn({ snapshot: input.turn }),
    conversation: input.conversationView ?? {
      status: 'ready',
      revision: input.conversation.revision,
      items: presentConversation({ snapshot: input.conversation }),
    },
    // Host-request and pending-interaction workflows are intentionally disabled.
    // The Runtime Gateway only exposes raw host-request facts until UI interaction semantics are designed.
    pendingInteractions: [],
    notices: [],
    capabilities: {
      actions: [],
      options: {},
    },
    stream: {
      status: 'disabled',
      revision: input.revision,
    },
  };
}

function presentThread(input: CreateClientSnapshotInput): ClientSnapshot['thread'] {
  if (input.selectedThread) {
    return {
      status: 'ready',
      title: input.selectedThread.title,
    };
  }

  return {
    status: 'none',
    title: null,
  };
}

function presentWorkspaceStatus(input: CreateClientSnapshotInput): ClientSnapshot['workspace']['status'] {
  if (!input.slot.workspace) {
    return 'none';
  }

  return input.workspace.available ? 'selected' : 'unavailable';
}
