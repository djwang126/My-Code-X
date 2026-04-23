import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';

import { sessionReducer } from '../state/session-reducer';
import { createInitialSessionState, type SessionAction, type SessionState } from '../state/session-state';

const SessionStateContext = createContext<SessionState | null>(null);
const SessionDispatchContext = createContext<Dispatch<SessionAction> | null>(null);

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, createInitialSessionState);

  return (
    <SessionStateContext.Provider value={state}>
      <SessionDispatchContext.Provider value={dispatch}>{children}</SessionDispatchContext.Provider>
    </SessionStateContext.Provider>
  );
}

export function useSessionState() {
  const value = useContext(SessionStateContext);
  if (!value) throw new Error('useSessionState must be used inside SessionProvider');
  return value;
}

export function useSessionDispatch() {
  const value = useContext(SessionDispatchContext);
  if (!value) throw new Error('useSessionDispatch must be used inside SessionProvider');
  return value;
}
