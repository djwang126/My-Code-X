import type { ReactNode } from 'react';

export interface AppProvidersProps {
  readonly children: ReactNode;
}

export function AppProviders(input: AppProvidersProps) {
  return input.children;
}
