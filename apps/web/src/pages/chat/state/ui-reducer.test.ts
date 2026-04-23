import { describe, expect, it } from 'vitest';

import { chatPageUiReducer, createInitialChatPageUiState } from './ui-reducer';

describe('chatPageUiReducer', () => {
  it('opens one primary overlay at a time and closes the previously active overlay', () => {
    const initialState = createInitialChatPageUiState();
    const withWorkspaceNavigation = chatPageUiReducer(initialState, {
      type: 'overlay/toggled',
      overlay: 'workspace-navigation',
    });
    const withToolsPanel = chatPageUiReducer(withWorkspaceNavigation, {
      type: 'overlay/toggled',
      overlay: 'tools-panel',
    });

    expect(withWorkspaceNavigation.primaryOverlay).toBe('workspace-navigation');
    expect(withToolsPanel.primaryOverlay).toBe('tools-panel');
  });

  it('closes the same primary overlay when toggled twice', () => {
    const initialState = createInitialChatPageUiState();
    const openedState = chatPageUiReducer(initialState, {
      type: 'overlay/toggled',
      overlay: 'chat-settings',
    });
    const closedState = chatPageUiReducer(openedState, {
      type: 'overlay/toggled',
      overlay: 'chat-settings',
    });

    expect(closedState.primaryOverlay).toBeNull();
  });

  it('closes any open overlay through the explicit close action', () => {
    const openedState = chatPageUiReducer(createInitialChatPageUiState(), {
      type: 'overlay/toggled',
      overlay: 'workspace-navigation',
    });
    const closedState = chatPageUiReducer(openedState, {
      type: 'overlay/closed',
    });

    expect(closedState.primaryOverlay).toBeNull();
  });
});
