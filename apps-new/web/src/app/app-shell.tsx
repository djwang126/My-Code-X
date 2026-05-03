import { useEffect, useMemo, useState } from 'react';
import type { ClientConversationView } from '@my-code-x/contracts-new';
import { ConversationView } from '../features/conversation-view/index.js';
import { applyConversationClientEvent } from '../features/conversation-view/model/index.js';
import { readAppConfig } from './app-config.js';
import { createClientSnapshotApiBoundary, type ClientEventSubscription } from './client-snapshot-api.js';
import { readAppScope } from './app-scope.js';
import { AppLayout } from './app-layout.js';

export function AppShell() {
  const config = readAppConfig();
  const scope = useMemo(() => readAppScope(), []);
  const api = useMemo(() => createClientSnapshotApiBoundary(), []);
  const [conversation, setConversation] = useState<ClientConversationView>(() => ({ status: 'loading' }));

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
    <AppLayout appName={config.appName} scopeLabel={scope.label}>
      <ConversationView conversation={conversation} />
    </AppLayout>
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load conversation';
}
