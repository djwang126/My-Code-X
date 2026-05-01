import { useEffect, useMemo, useState } from 'react';
import type { ClientConversationView } from '@my-code-x/contracts-new';
import { ConversationView } from '../features/conversation-view/index.js';
import { readAppConfig } from './app-config.js';
import { createClientSnapshotApiBoundary } from './client-snapshot-api.js';
import { readAppScope } from './app-scope.js';
import { AppLayout } from './app-layout.js';

export function AppShell() {
  const config = readAppConfig();
  const scope = useMemo(() => readAppScope(), []);
  const api = useMemo(() => createClientSnapshotApiBoundary(), []);
  const [conversation, setConversation] = useState<ClientConversationView>(() => ({ status: 'loading' }));

  useEffect(() => {
    let disposed = false;

    setConversation({ status: 'loading' });
    api.loadSnapshot({ scope })
      .then(snapshot => {
        if (disposed) {
          return;
        }

        setConversation(snapshot.conversation);
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
