import type { ChatPageUiState } from './chat-page-state-types';

export type ChatPageUiAction =
  | { type: 'overlay/opened'; overlay: NonNullable<ChatPageUiState['primaryOverlay']> }
  | { type: 'overlay/toggled'; overlay: NonNullable<ChatPageUiState['primaryOverlay']> }
  | { type: 'overlay/closed' };

export function createInitialChatPageUiState(): ChatPageUiState {
  return {
    primaryOverlay: null,
  };
}

export function chatPageUiReducer(
  state: ChatPageUiState,
  action: ChatPageUiAction,
): ChatPageUiState {
  if (action.type === 'overlay/closed') {
    return {
      primaryOverlay: null,
    };
  }

  if (action.type === 'overlay/opened') {
    return {
      primaryOverlay: action.overlay,
    };
  }

  if (action.type === 'overlay/toggled') {
    return {
      primaryOverlay: state.primaryOverlay === action.overlay ? null : action.overlay,
    };
  }

  return state;
}
