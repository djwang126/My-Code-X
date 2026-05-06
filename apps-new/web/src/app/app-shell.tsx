import { useEffect, useMemo, useState } from 'react';
import type { ClientConversationView } from '@my-code-x/contracts-new';
import { ConversationView } from '../features/conversation-view/index.js';
import { applyConversationClientEvent } from '../features/conversation-view/model/index.js';
import {
  createWorkspacePanelApiBoundary,
  useWorkspacePanelController,
  WorkspacePanel,
} from '../features/workspace-panel/index.js';
import { readAppConfig } from './app-config.js';
import { createClientSnapshotApiBoundary, type ClientEventSubscription } from './client-snapshot-api.js';
import { readAppScope } from './app-scope.js';
import { AppLayout } from './app-layout.js';
import { applyResumeSnapshotToAppShellState, createScopeFromSnapshot } from './app-shell-state.js';
import { createFailedConversationView } from './app-conversation-state.js';

export function AppShell() {
  const config = readAppConfig();
  const [scope, setScope] = useState(() => readAppScope());
  const api = useMemo(() => createClientSnapshotApiBoundary(), []);
  const workspaceApi = useMemo(() => createWorkspacePanelApiBoundary({ sendAction: action => api.sendAction(action) }), [api]);
  const [conversation, setConversation] = useState<ClientConversationView>(() => ({ status: 'loading', revision: 0 }));
  const workspacePanel = useWorkspacePanelController({
    scope,
    api: workspaceApi,
    onResumeAccepted(snapshot) {
      const nextState = applyResumeSnapshotToAppShellState({
        state: {
          scope,
          conversation,
        },
        snapshot,
      });
      setConversation(nextState.conversation);
      writeBrowserScope(nextState.scope);
      setScope(nextState.scope);
    },
  });

  useEffect(() => {
    let disposed = false;
    let subscription: ClientEventSubscription | null = null;

    setConversation({ status: 'loading', revision: 0 });
    api.loadSnapshot({ scope })
      .then(snapshot => {
        if (disposed) {
          return;
        }

        setConversation(snapshot.conversation);
        subscription = api.subscribeEvents({
          scope,
          receive(event) {
            setConversation(current => applyConversationClientEvent({
              scope: {
                slotId: scope.slotId,
                threadId: scope.threadId,
              },
              conversation: current,
              event,
            }));
          },
          fail(error) {
            setConversation(current => createFailedConversationView({
              current,
              error,
            }));
          },
        });
      })
      .catch(error => {
        if (disposed) {
          return;
        }

        setConversation(current => createFailedConversationView({
          current,
          error,
        }));
      });

    return () => {
      disposed = true;
      subscription?.close();
    };
  }, [api, scope]);

  return (
    <AppLayout appName={config.appName} scopeLabel={scope.label} onWorkspaceClick={workspacePanel.open}>
      <ConversationView conversation={conversation} />
      {workspacePanel.state.status !== 'closed' ? (
        <button
          aria-label="关闭 Workspace panel overlay"
          className="workspace-panel-overlay"
          type="button"
          onClick={workspacePanel.close}
        />
      ) : null}
      <WorkspacePanel
        state={workspacePanel.state}
        onAddClick={workspacePanel.openAddModal}
        onAddSubmit={workspacePanel.submitAdd}
        onBackToWorkspaceList={workspacePanel.showWorkspaceList}
        onCloseRequest={workspacePanel.close}
        onEditCwdClick={workspacePanel.openEditCwdModal}
        onEditCwdSubmit={workspacePanel.submitEditCwd}
        onLoadMoreActiveThreads={workspacePanel.loadMoreActiveThreads}
        onOpenActiveThreadsClick={workspacePanel.openActiveThreads}
        onRemoveClick={workspacePanel.remove}
        onRenameClick={workspacePanel.openRenameModal}
        onRenameSubmit={workspacePanel.submitRename}
        onResumeThread={workspacePanel.resumeThread}
      />
    </AppLayout>
  );
}

function writeBrowserScope(scope: ReturnType<typeof createScopeFromSnapshot>): void {
  const params = new URLSearchParams();
  appendNullableSearchParam({ params, name: 'slotId', value: scope.slotId });
  appendNullableSearchParam({ params, name: 'workspaceId', value: scope.workspaceId });
  appendNullableSearchParam({ params, name: 'threadId', value: scope.threadId });
  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', nextUrl);
}

function appendNullableSearchParam(input: {
  readonly params: URLSearchParams;
  readonly name: string;
  readonly value: string | null;
}): void {
  if (input.value === null) {
    return;
  }

  input.params.set(input.name, input.value);
}
