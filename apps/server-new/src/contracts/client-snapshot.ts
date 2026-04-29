import type { JsonValue } from '../shared/index.js';
import type { ClientConversationItem } from './conversation-item.js';
import type { PendingInteraction } from './pending-interaction.js';
import type { ClientTurnView } from './turn-view.js';

export interface ClientSnapshot {
  readonly app: ClientAppView;
  readonly identity: ClientIdentityView;
  readonly selection: ClientSelectionView;
  readonly workspace: ClientWorkspaceView;
  readonly thread: ClientThreadView;
  readonly turn: ClientTurnView;
  readonly conversation: ClientConversationView;
  readonly pendingInteractions: readonly PendingInteraction[];
  readonly notices: readonly ClientNoticeView[];
  readonly capabilities: ClientCapabilitiesView;
  readonly stream: ClientStreamView;
}

export interface ClientAppView {
  readonly status: 'ready' | 'degraded' | 'unavailable';
}

export interface ClientIdentityView {
  readonly slotId: string;
}

export interface ClientSelectionView {
  readonly workspaceId: string | null;
  readonly threadId: string | null;
}

export interface ClientWorkspaceView {
  readonly status: 'none' | 'selected' | 'unavailable';
}

export interface ClientThreadView {
  readonly status: 'none' | 'opening' | 'ready' | 'archived' | 'failed';
  readonly title: string | null;
}

export interface ClientConversationView {
  readonly items: readonly ClientConversationItem[];
}

export interface ClientNoticeView {
  readonly id: string;
  readonly level: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly body: string;
}

export interface ClientCapabilitiesView {
  readonly actions: readonly string[];
  readonly options: JsonValue;
}

export interface ClientStreamView {
  readonly status: 'disabled' | 'available';
  readonly revision: string;
}
