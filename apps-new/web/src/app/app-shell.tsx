import { ConversationView } from '../features/conversation-view/index.js';
import { readAppConfig } from './app-config.js';
import { readAppScope } from './app-scope.js';
import { AppLayout } from './app-layout.js';

export function AppShell() {
  const config = readAppConfig();
  const scope = readAppScope();

  return (
    <AppLayout appName={config.appName} scopeLabel={scope.label}>
      <ConversationView />
    </AppLayout>
  );
}
