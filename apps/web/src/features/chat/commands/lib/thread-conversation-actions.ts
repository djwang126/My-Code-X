import type { Dispatch, SetStateAction } from 'react';

type ThreadConversationAction = (() => boolean | Promise<boolean>) | undefined;

type CreateThreadConversationActionsInput = {
  onCompact?: ThreadConversationAction;
  onNewThread?: ThreadConversationAction;
  onRollback?: ThreadConversationAction;
  setBottomDrawerOpen: Dispatch<SetStateAction<boolean>>;
};

async function runAndCloseBottomDrawer({
  action,
  setBottomDrawerOpen,
}: {
  action?: ThreadConversationAction;
  setBottomDrawerOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const result = (await action?.()) ?? false;
  setBottomDrawerOpen(false);
  return result;
}

export function createThreadConversationActions(input: CreateThreadConversationActionsInput) {
  return {
    onCompact: () => runAndCloseBottomDrawer({ action: input.onCompact, setBottomDrawerOpen: input.setBottomDrawerOpen }),
    onNewThread: () => runAndCloseBottomDrawer({ action: input.onNewThread, setBottomDrawerOpen: input.setBottomDrawerOpen }),
    onRollback: () => runAndCloseBottomDrawer({ action: input.onRollback, setBottomDrawerOpen: input.setBottomDrawerOpen }),
  };
}
