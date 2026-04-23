import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';

import { chatRuntimeReducer } from '../state/chat-runtime-reducer';
import { createInitialChatRuntimeState, type ChatRuntimeAction, type ChatRuntimeState } from '../state/chat-runtime-state';

const ChatRuntimeStateContext = createContext<ChatRuntimeState | null>(null);
const ChatRuntimeDispatchContext = createContext<Dispatch<ChatRuntimeAction> | null>(null);

type ChatRuntimeProviderProps = {
  children: ReactNode;
};

export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
  const [state, dispatch] = useReducer(chatRuntimeReducer, undefined, createInitialChatRuntimeState);

  return (
    <ChatRuntimeStateContext.Provider value={state}>
      <ChatRuntimeDispatchContext.Provider value={dispatch}>{children}</ChatRuntimeDispatchContext.Provider>
    </ChatRuntimeStateContext.Provider>
  );
}

export function useChatRuntimeState() {
  const value = useContext(ChatRuntimeStateContext);
  if (!value) throw new Error('useChatRuntimeState must be used inside ChatRuntimeProvider');
  return value;
}

export function useChatRuntimeDispatch() {
  const value = useContext(ChatRuntimeDispatchContext);
  if (!value) throw new Error('useChatRuntimeDispatch must be used inside ChatRuntimeProvider');
  return value;
}
