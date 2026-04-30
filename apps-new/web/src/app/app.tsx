import { AppProviders } from './app-providers.js';
import { AppShell } from './app-shell.js';
import './app.css';

export function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
