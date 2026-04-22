import type { ReactNode } from 'react';

import { ChatRuntimeProvider } from '../features/chat-runtime';
import { SessionProvider } from '../features/session';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ChatRuntimeProvider>{children}</ChatRuntimeProvider>
    </SessionProvider>
  );
}
