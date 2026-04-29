export type ClientTurnLifecycle = 'idle' | 'starting' | 'streaming' | 'waiting-for-input' | 'completed' | 'failed' | 'interrupted';

export type ClientTurnView =
  | { readonly lifecycle: 'idle'; readonly active: false; readonly canSend: true; readonly canInterrupt: false; readonly visibleStatus: string }
  | { readonly lifecycle: 'starting' | 'streaming'; readonly active: true; readonly canSend: false; readonly canInterrupt: true; readonly visibleStatus: string }
  | { readonly lifecycle: 'waiting-for-input'; readonly active: true; readonly canSend: false; readonly canInterrupt: true; readonly visibleStatus: string }
  | { readonly lifecycle: 'completed' | 'failed' | 'interrupted'; readonly active: false; readonly canSend: true; readonly canInterrupt: false; readonly visibleStatus: string };
