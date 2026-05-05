import type {
  ClientWorkspaceActiveThreadsPageView,
  ClientWorkspaceErrorView,
  ClientWorkspaceListItemView,
  ClientWorkspacePanelView,
  ClientWorkspacePanelPageView,
  ClientWorkspaceThreadItemView,
} from '@my-code-x/contracts-new';

export type ReadyWorkspacePanelView = Extract<ClientWorkspacePanelView, { readonly status: 'ready' }>;

export type WorkspacePanelState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly panel: ReadyWorkspacePanelView;
      readonly modal: WorkspacePanelModalState;
      readonly listError: string | null;
    }
  | { readonly status: 'failed'; readonly message: string };

export type WorkspacePanelModalState =
  | { readonly status: 'none' }
  | { readonly status: 'add'; readonly submit: WorkspaceModalSubmitState }
  | { readonly status: 'rename'; readonly item: ClientWorkspaceListItemView; readonly submit: WorkspaceModalSubmitState }
  | { readonly status: 'edit-cwd'; readonly item: ClientWorkspaceListItemView; readonly submit: WorkspaceModalSubmitState };

export type WorkspaceModalSubmitState =
  | { readonly status: 'idle'; readonly error: string | null }
  | { readonly status: 'submitting' };

export type WorkspacePanelAction =
  | { readonly kind: 'open-started' }
  | { readonly kind: 'open-succeeded'; readonly panel: ReadyWorkspacePanelView }
  | { readonly kind: 'open-failed'; readonly message: string }
  | { readonly kind: 'open-add-modal' }
  | { readonly kind: 'open-rename-modal'; readonly item: ClientWorkspaceListItemView }
  | { readonly kind: 'open-edit-cwd-modal'; readonly item: ClientWorkspaceListItemView }
  | { readonly kind: 'submit-started' }
  | { readonly kind: 'submit-succeeded'; readonly panel: ReadyWorkspacePanelView }
  | { readonly kind: 'submit-failed'; readonly message: string }
  | { readonly kind: 'list-action-failed'; readonly message: string }
  | { readonly kind: 'show-workspace-list' }
  | { readonly kind: 'active-open-started'; readonly item: ClientWorkspaceListItemView }
  | { readonly kind: 'active-open-succeeded'; readonly panel: ReadyWorkspacePanelView }
  | { readonly kind: 'active-open-failed'; readonly error: ClientWorkspaceErrorView }
  | { readonly kind: 'active-load-more-started' }
  | { readonly kind: 'active-load-more-succeeded'; readonly panel: ReadyWorkspacePanelView }
  | { readonly kind: 'active-load-more-failed'; readonly error: ClientWorkspaceErrorView }
  | { readonly kind: 'active-resume-started'; readonly threadId: string }
  | { readonly kind: 'active-resume-failed'; readonly threadId: string; readonly message: string }
  | { readonly kind: 'close-requested' };

export function createInitialWorkspacePanelState(): WorkspacePanelState {
  return {
    status: 'closed',
  };
}

export function reduceWorkspacePanelState(state: WorkspacePanelState, action: WorkspacePanelAction): WorkspacePanelState {
  switch (action.kind) {
    case 'open-started':
      return { status: 'loading' };

    case 'open-succeeded':
      return {
        status: 'ready',
        panel: action.panel,
        modal: { status: 'none' },
        listError: null,
      };

    case 'open-failed':
      return {
        status: 'failed',
        message: action.message,
      };

    case 'open-add-modal':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        modal: {
          status: 'add',
          submit: createIdleSubmitState(),
        },
      };

    case 'open-rename-modal':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        listError: null,
        modal: {
          status: 'rename',
          item: action.item,
          submit: createIdleSubmitState(),
        },
      };

    case 'open-edit-cwd-modal':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        listError: null,
        modal: {
          status: 'edit-cwd',
          item: action.item,
          submit: createIdleSubmitState(),
        },
      };

    case 'submit-started':
      if (state.status !== 'ready' || state.modal.status === 'none') {
        return state;
      }
      return {
        ...state,
        listError: null,
        modal: {
          ...state.modal,
          submit: {
            status: 'submitting',
          },
        },
      };

    case 'submit-succeeded':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        status: 'ready',
        panel: action.panel,
        modal: { status: 'none' },
        listError: null,
      };

    case 'submit-failed':
      if (state.status !== 'ready' || state.modal.status === 'none') {
        return state;
      }
      return {
        ...state,
        modal: {
          ...state.modal,
          submit: createIdleSubmitState(action.message),
        },
      };

    case 'list-action-failed':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        listError: action.message,
      };

    case 'show-workspace-list':
      if (state.status !== 'ready') {
        return state;
      }
      return replacePanelPage({
        state,
        page: {
          kind: 'workspace-list',
        },
      });

    case 'active-open-started':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        panel: {
          ...state.panel,
          list: optimisticallySelectWorkspaceListItem({
            items: state.panel.list.items,
            persistence: state.panel.list.persistence,
            workspaceId: action.item.workspaceId,
          }),
          page: {
            kind: 'active-threads',
            workspaceId: action.item.workspaceId,
            name: action.item.name,
            cwd: action.item.cwd,
            resource: {
              status: 'loading',
            },
          },
        },
        listError: null,
      };

    case 'active-open-succeeded':
      if (state.status !== 'ready') {
        return state;
      }
      return {
        ...state,
        panel: action.panel,
        listError: null,
      };

    case 'active-open-failed':
      if (state.status !== 'ready' || state.panel.page.kind !== 'active-threads') {
        return state;
      }
      return replacePanelPage({
        state,
        page: {
          kind: 'active-threads',
          workspaceId: state.panel.page.workspaceId,
          name: state.panel.page.name,
          cwd: state.panel.page.cwd,
          resource: {
            status: 'failed',
            error: action.error,
          },
        },
      });

    case 'active-load-more-started':
      return updateActiveReadyResource(state, resource => ({
        ...resource,
        loadMore: {
          status: 'loading',
        },
      }));

    case 'active-load-more-succeeded':
      if (state.status !== 'ready' || state.panel.page.kind !== 'active-threads' || action.panel.page.kind !== 'active-threads') {
        return state;
      }
      if (state.panel.page.resource.status !== 'ready' || action.panel.page.resource.status !== 'ready') {
        return {
          ...state,
          panel: action.panel,
          listError: null,
        };
      }
      return {
        ...state,
        panel: {
          ...action.panel,
          page: {
            ...action.panel.page,
            resource: {
              ...action.panel.page.resource,
              items: [
                ...state.panel.page.resource.items,
                ...action.panel.page.resource.items,
              ],
            },
          },
        },
        listError: null,
      };

    case 'active-load-more-failed':
      return updateActiveReadyResource(state, resource => ({
        ...resource,
        loadMore: {
          status: 'failed',
          error: action.error,
        },
      }));

    case 'active-resume-started':
      return updateActiveThreadItems(state, item => {
        if (item.threadId !== action.threadId || item.current) {
          return item;
        }

        return {
          ...item,
          operation: 'resuming',
          cardError: null,
        };
      });

    case 'active-resume-failed':
      return updateActiveThreadItems(state, item => {
        if (item.threadId !== action.threadId) {
          return item;
        }

        return {
          ...item,
          operation: 'idle',
          cardError: {
            code: 'thread-resume-failed',
            message: action.message,
          },
        };
      });

    case 'close-requested':
      if (state.status === 'ready' && state.modal.status !== 'none' && state.modal.submit.status === 'submitting') {
        return state;
      }
      return { status: 'closed' };
  }
}

function createIdleSubmitState(error: string | null = null): WorkspaceModalSubmitState {
  return {
    status: 'idle',
    error,
  };
}

function replacePanelPage(input: {
  readonly state: Extract<WorkspacePanelState, { readonly status: 'ready' }>;
  readonly page: ClientWorkspacePanelPageView;
}): WorkspacePanelState {
  return {
    ...input.state,
    panel: {
      ...input.state.panel,
      page: input.page,
    },
    listError: null,
  };
}

// Only used while the active thread page is loading. The server returned panel is
// authoritative after success because it owns Workspace operation policy.
function optimisticallySelectWorkspaceListItem(input: {
  readonly persistence: ReadyWorkspacePanelView['list']['persistence'];
  readonly items: readonly ClientWorkspaceListItemView[];
  readonly workspaceId: string;
}): ReadyWorkspacePanelView['list'] {
  return {
    persistence: input.persistence,
    selectedWorkspaceId: input.workspaceId,
    items: input.items.map(item => {
      const selected = item.workspaceId === input.workspaceId;

      return {
        ...item,
        selected,
        operations: readOptimisticWorkspaceOperations({ item, selected }),
      };
    }),
  };
}

function readOptimisticWorkspaceOperations(input: {
  readonly item: ClientWorkspaceListItemView;
  readonly selected: boolean;
}): ClientWorkspaceListItemView['operations'] {
  if (input.item.availability.status === 'unavailable') {
    return ['remove'];
  }

  if (input.selected) {
    return ['rename', 'edit-cwd'];
  }

  return ['rename', 'edit-cwd', 'remove'];
}

function updateActiveReadyResource(
  state: WorkspacePanelState,
  update: (
    resource: Extract<ClientWorkspaceActiveThreadsPageView['resource'], { readonly status: 'ready' }>,
  ) => Extract<ClientWorkspaceActiveThreadsPageView['resource'], { readonly status: 'ready' }>,
): WorkspacePanelState {
  if (state.status !== 'ready' || state.panel.page.kind !== 'active-threads' || state.panel.page.resource.status !== 'ready') {
    return state;
  }

  return replacePanelPage({
    state,
    page: {
      ...state.panel.page,
      resource: update(state.panel.page.resource),
    },
  });
}

function updateActiveThreadItems(
  state: WorkspacePanelState,
  update: (item: ClientWorkspaceThreadItemView) => ClientWorkspaceThreadItemView,
): WorkspacePanelState {
  return updateActiveReadyResource(state, resource => ({
    ...resource,
    items: resource.items.map(item => update(item)),
  }));
}
