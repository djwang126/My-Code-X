import type { ClientWorkspacePanelPageView, ClientWorkspacePanelView } from '@my-code-x/contracts-new';
import type { WorkspaceListSnapshot } from '../features/workspace/index.js';

export interface PresentWorkspacePanelInput {
  readonly list: WorkspaceListSnapshot;
  readonly page?: ClientWorkspacePanelPageView;
}

export function presentWorkspacePanel(input: PresentWorkspacePanelInput): ClientWorkspacePanelView {
  return {
    status: 'ready',
    list: {
      persistence: input.list.persistence.status === 'memory'
        ? {
            status: 'memory',
            warning: input.list.persistence.warning,
            error: {
              code: input.list.persistence.error.code,
              message: input.list.persistence.error.message,
            },
          }
        : { status: 'persistent' },
      selectedWorkspaceId: input.list.selectedWorkspaceId,
      items: input.list.items.map(item => ({
        workspaceId: item.workspaceId,
        recordRef: item.recordRef,
        name: item.name,
        cwd: item.cwd,
        availability: item.availability.status === 'available'
          ? { status: 'available' }
          : { status: 'unavailable', reason: item.availability.reason },
        selected: item.selected,
        operations: [...item.operations],
      })),
    },
    page: input.page ?? {
      kind: 'workspace-list',
    },
  };
}
