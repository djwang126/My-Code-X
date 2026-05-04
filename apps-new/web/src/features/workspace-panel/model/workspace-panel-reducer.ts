import type { ClientWorkspaceListItemView, ClientWorkspacePanelView } from '@my-code-x/contracts-new';

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
