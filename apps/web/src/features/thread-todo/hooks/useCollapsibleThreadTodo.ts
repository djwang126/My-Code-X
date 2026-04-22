import { useCallback, useEffect, useState } from 'react';

import type { ActiveThreadTodo } from '../types';

export function useCollapsibleThreadTodo({
  activeTodo,
  threadId,
  workspace,
}: {
  activeTodo: ActiveThreadTodo | null;
  threadId: string;
  workspace: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(false);
  }, [threadId, workspace, activeTodo?.key]);

  const toggleCollapsed = useCallback(() => {
    if (activeTodo) {
      setCollapsed(current => !current);
    }
  }, [activeTodo]);

  return {
    visibleTodo: activeTodo,
    todoCollapsed: Boolean(activeTodo) && collapsed,
    toggleCollapsed,
  };
}
