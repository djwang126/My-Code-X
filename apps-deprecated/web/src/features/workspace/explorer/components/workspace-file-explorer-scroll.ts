export type WorkspaceExplorerScrollSnapshot = {
  top: number;
  ratio: number;
};

export function captureWorkspaceExplorerScrollSnapshot(
  element: HTMLElement | HTMLTextAreaElement | null,
): WorkspaceExplorerScrollSnapshot {
  if (!element) {
    return { top: 0, ratio: 0 };
  }

  const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0);
  return {
    top: element.scrollTop,
    ratio: maxScrollTop > 0 ? element.scrollTop / maxScrollTop : 0,
  };
}

export function restoreWorkspaceExplorerScrollSnapshot(
  element: HTMLElement | HTMLTextAreaElement | null,
  snapshot: WorkspaceExplorerScrollSnapshot | null,
) {
  if (!element || !snapshot) {
    return;
  }

  const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0);
  const nextTop = maxScrollTop > 0 ? snapshot.ratio * maxScrollTop : snapshot.top;
  element.scrollTop = Math.max(0, Math.min(nextTop, maxScrollTop));
}
