import type { SavedWorkspace, WorkspaceDraft } from '../../../features/workspace/bookmarks';

type WorkspaceDraftAction =
  | { type: 'path/changed'; value: string }
  | { type: 'label/changed'; value: string }
  | { type: 'editing/started'; workspace: SavedWorkspace }
  | { type: 'draft/cleared' };

export function createInitialWorkspaceDraft(): WorkspaceDraft {
  return {
    path: '',
    label: '',
  };
}

export function workspaceDraftReducer(
  state: WorkspaceDraft,
  action: WorkspaceDraftAction,
): WorkspaceDraft {
  if (action.type === 'path/changed') {
    return {
      ...state,
      path: action.value,
    };
  }

  if (action.type === 'label/changed') {
    return {
      ...state,
      label: action.value,
    };
  }

  if (action.type === 'editing/started') {
    return {
      path: action.workspace.path,
      label: action.workspace.label,
    };
  }

  if (action.type === 'draft/cleared') {
    return createInitialWorkspaceDraft();
  }

  return state;
}
