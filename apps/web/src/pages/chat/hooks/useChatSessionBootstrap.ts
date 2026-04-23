import { useCallback } from 'react';

import {
  fetchSessionPayload,
  type SessionPayload,
  useChatRuntimeDispatch,
} from '../../../features/chat/runtime';
import { useSessionBootstrap } from '../../../features/session';
import { applyChatBootstrapPayload } from '../lib/apply-chat-bootstrap-payload';

type UseChatSessionBootstrapOptions = {
  autoStart?: boolean;
};

type ChatBootstrapResetInput = {
  workspace: string;
  threadId: string;
};

type ChatBootstrapSelectionInput = {
  workspace: string;
  threadId: string;
};

type ChatBootstrapSucceededInput = {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
  serverInstanceId: string;
};

type ApplyChatBootstrapPayloadCallbackInput = {
  payload: SessionPayload;
  selectThread: (input: ChatBootstrapSelectionInput) => void;
  dispatchSessionBootstrapSucceeded: (input: ChatBootstrapSucceededInput) => void;
};

export function useChatSessionBootstrap({
  autoStart = true,
}: UseChatSessionBootstrapOptions = {}) {
  const chatDispatch = useChatRuntimeDispatch();

  const resetBootstrapState = useCallback(
    ({ workspace, threadId }: ChatBootstrapResetInput) => {
      chatDispatch({ type: 'bootstrap/reset', workspace, threadId });
    },
    [chatDispatch],
  );

  const applyBootstrapPayload = useCallback(
    ({
      payload,
      selectThread,
      dispatchSessionBootstrapSucceeded,
    }: ApplyChatBootstrapPayloadCallbackInput) => {
      applyChatBootstrapPayload({
        payload,
        selectThread,
        dispatchSessionBootstrapSucceeded,
        dispatchChatBootstrapSucceeded: nextPayload =>
          chatDispatch({
            type: 'bootstrap/succeeded',
            payload: nextPayload,
          }),
      });
    },
    [chatDispatch],
  );

  return useSessionBootstrap({
    autoStart,
    fetchBootstrapPayload: fetchSessionPayload,
    resetBootstrapState,
    applyBootstrapPayload,
  });
}
