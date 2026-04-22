import { describe, expect, it } from 'vitest';

import { chatPageUiReducer, createInitialChatPageUiState } from './chat-page-ui-reducer';

describe('chatPageUiReducer', () => {
  it('opens one primary overlay at a time and closes the previously active overlay', () => {
    const initialState = createInitialChatPageUiState();
    const withWorkspaceSidebar = chatPageUiReducer(initialState, {
      type: 'overlay/toggled',
      overlay: 'workspace-sidebar',
    });
    const withThreadTools = chatPageUiReducer(withWorkspaceSidebar, {
      type: 'overlay/toggled',
      overlay: 'thread-tools',
    });

    expect(withWorkspaceSidebar.primaryOverlay).toBe('workspace-sidebar');
    expect(withThreadTools.primaryOverlay).toBe('thread-tools');
  });

  it('closes the same primary overlay when toggled twice', () => {
    const initialState = createInitialChatPageUiState();
    const openedState = chatPageUiReducer(initialState, {
      type: 'overlay/toggled',
      overlay: 'runtime-settings',
    });
    const closedState = chatPageUiReducer(openedState, {
      type: 'overlay/toggled',
      overlay: 'runtime-settings',
    });

    expect(closedState.primaryOverlay).toBeNull();
  });

  it('closes any open overlay through the explicit close action', () => {
    const openedState = chatPageUiReducer(createInitialChatPageUiState(), {
      type: 'overlay/toggled',
      overlay: 'workspace-sidebar',
    });
    const closedState = chatPageUiReducer(openedState, {
      type: 'overlay/closed',
    });

    expect(closedState.primaryOverlay).toBeNull();
  });
});
