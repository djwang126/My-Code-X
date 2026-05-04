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

export function AppShell() {
  const config = readAppConfig();
  const scope = useMemo(() => readAppScope(), []);
  const api = useMemo(() => createClientSnapshotApiBoundary(), []);
  const workspaceApi = useMemo(() => createWorkspacePanelApiBoundary({ sendAction: action => api.sendAction(action) }), [api]);
  const [conversation, setConversation] = useState<ClientConversationView>(() => ({ status: 'loading' }));
  const workspacePanel = useWorkspacePanelController({ scope, api: workspaceApi });

  useEffect(() => {
    let disposed = false;
    let subscription: ClientEventSubscription | null = null;

    setConversation({ status: 'loading' });
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
            setConversation({
              status: 'failed',
              error: {
                message: readErrorMessage(error),
              },
            });
          },
        });
      })
      .catch(error => {
        if (disposed) {
          return;
        }

        setConversation({
          status: 'failed',
          error: {
            message: readErrorMessage(error),
          },
        });
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
        onCloseRequest={workspacePanel.close}
        onEditCwdClick={workspacePanel.openEditCwdModal}
        onEditCwdSubmit={workspacePanel.submitEditCwd}
        onRemoveClick={workspacePanel.remove}
        onRenameClick={workspacePanel.openRenameModal}
        onRenameSubmit={workspacePanel.submitRename}
      />
    </AppLayout>
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load conversation';
}
