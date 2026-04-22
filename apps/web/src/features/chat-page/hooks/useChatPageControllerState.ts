import { useCallback, useEffect, useReducer, useState } from 'react';

import { chatPageErrorReducer } from '../state/chat-page-error-state';
import { inferChatPageError } from '../state/chat-page-error-inference';
import { chatPageOperationReducer, createInitialChatPageOperationState } from '../state/chat-page-operation-state';
import type { ChatInteractionState, ChatPageError, ChatPageErrorKind, ChatPageOperationKey } from '../state/chat-page-state-types';

type UseChatPageControllerStateInput = {
  interactionState: ChatInteractionState;
  sessionErrorMessage: string;
};

export function useChatPageControllerState(input: UseChatPageControllerStateInput) {
  const [operations, dispatchOperation] = useReducer(chatPageOperationReducer, undefined, createInitialChatPageOperationState);
  const [localError, dispatchError] = useReducer(chatPageErrorReducer, null);
  const [sessionErrorHint, setSessionErrorHint] = useState<ChatPageErrorKind | null>(null);

  useEffect(() => {
    if (!input.sessionErrorMessage.trim()) {
      setSessionErrorHint(null);
    }
  }, [input.sessionErrorMessage]);

  const startOperation = useCallback((operation: ChatPageOperationKey) => {
    dispatchOperation({ type: 'operation/started', operation });
  }, []);

  const finishOperation = useCallback((operation: ChatPageOperationKey) => {
    dispatchOperation({ type: 'operation/finished', operation });
  }, []);

  const setOperationPending = useCallback((operation: ChatPageOperationKey, pending: boolean) => {
    if (pending) {
      startOperation(operation);
      return;
    }

    finishOperation(operation);
  }, [finishOperation, startOperation]);

  const clearError = useCallback(() => {
    dispatchError({ type: 'error/cleared' });
  }, []);

  const recordError = useCallback((error: ChatPageError) => {
    dispatchError({ type: 'error/recorded', error });
    return false;
  }, []);

  return {
    operations,
    currentError:
      localError ??
      inferChatPageError({
        interactionState: input.interactionState,
        message: input.sessionErrorMessage,
        sessionErrorHint,
      }),
    setSessionErrorHint,
    startOperation,
    finishOperation,
    setOperationPending,
    clearError,
    recordError,
  };
}

export type UseChatPageControllerStateResult = ReturnType<typeof useChatPageControllerState>;
