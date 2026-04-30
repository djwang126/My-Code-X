import type { ReactNode } from 'react';

export interface AppLayoutProps {
  readonly appName: string;
  readonly scopeLabel: string;
  readonly children: ReactNode;
}

export function AppLayout(input: AppLayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div>
          <p className="app-shell__eyebrow">apps-new/web</p>
          <h1 className="app-shell__title">{input.appName}</h1>
        </div>
        <p className="app-shell__scope">{input.scopeLabel}</p>
      </header>
      <main className="app-shell__main">{input.children}</main>
    </div>
  );
}
