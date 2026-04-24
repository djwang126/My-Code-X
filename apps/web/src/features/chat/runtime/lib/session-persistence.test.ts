import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseChatTurn } from '@my-code-x/contracts';

import {
  getBootstrapIdentity,
  readBootstrapScope,
  setActiveWorkspacePath,
  synchronizeStoredThreadId,
} from '../../../session';
import {
  listSavedWorkspaces,
  removeSavedWorkspace,
  saveWorkspace,
} from '../../../workspace/bookmarks';
import { loadStoredRuntimePreferences, persistRuntimePreferences } from '../../settings';
import {
  clearTranscriptCache,
  loadBootstrapTranscriptCache,
  loadTranscriptCache,
  persistTranscriptCache,
} from './transcript-cache-storage';

function setSlotUrl(slotId?: string) {
  const search = slotId ? `?slot=${slotId}` : '';
  window.history.replaceState({}, '', `/${search}`);
}

function createChatTurn(
  turnId: string,
  status: 'inProgress' | 'completed' | 'interrupted' | 'failed',
) {
  return parseChatTurn({
    id: turnId,
    status: status,
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  });
}

describe('session persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    setSlotUrl();
    vi.restoreAllMocks();
  });

  it('persists normalized saved workspaces without duplicating the same path', () => {
    const first = saveWorkspace({
      path: 'D:\\workspaces\\My-Code-X\\',
      label: 'Primary repo',
    });
    const second = saveWorkspace({
      path: 'D:/workspaces/My-Code-X',
      label: 'Renamed repo',
    });

    expect(first.path).toBe('D:/workspaces/My-Code-X');
    expect(second.path).toBe('D:/workspaces/My-Code-X');
    expect(listSavedWorkspaces()).toEqual([
      {
        path: 'D:/workspaces/My-Code-X',
        label: 'Renamed repo',
        lastThreadId: '',
      },
    ]);
  });

  it('stores active workspace and thread per slot', () => {
    setSlotUrl('slot-codex');
    setActiveWorkspacePath('slot-codex', 'D:/workspaces/codex');
    synchronizeStoredThreadId('slot-codex', 'thread-codex');

    expect(getBootstrapIdentity()).toMatchObject({
      slotId: 'slot-codex',
      workspace: 'D:/workspaces/codex',
      threadId: 'thread-codex',
    });

    setSlotUrl('slot-other');

    expect(getBootstrapIdentity()).toMatchObject({
      slotId: 'slot-other',
      workspace: '',
      threadId: '',
    });
  });

  it('does not persist workspace threads onto a saved workspace when relabeling it', () => {
    setSlotUrl('slot-1');
    saveWorkspace({
      path: 'D:/workspaces/My-Code-X',
      label: 'My-Code-X',
    });
    setActiveWorkspacePath('slot-1', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-1', 'thread-17');

    saveWorkspace({
      path: 'D:/workspaces/My-Code-X',
      label: 'Renamed workspace',
    });

    expect(listSavedWorkspaces()).toEqual([
      {
        path: 'D:/workspaces/My-Code-X',
        label: 'Renamed workspace',
        lastThreadId: '',
      },
    ]);
  });

  it('ignores a workspace-level remembered thread during bootstrap', () => {
    setSlotUrl('slot-main');
    window.localStorage.setItem(
      'my-code-x-saved-workspaces',
      JSON.stringify([
        {
          path: 'D:/workspaces/My-Code-X',
          label: 'My-Code-X',
          lastThreadId: 'thread-from-other-slot',
        },
      ]),
    );

    setActiveWorkspacePath('slot-main', 'D:/workspaces/My-Code-X');

    expect(getBootstrapIdentity()).toMatchObject({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: '',
    });
  });

  it('removing a saved workspace no longer mutates the active slot selection', () => {
    setSlotUrl('slot-1');
    saveWorkspace({
      path: 'D:/workspaces/My-Code-X',
      label: 'My-Code-X',
    });

    setActiveWorkspacePath('slot-1', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-1', 'thread-17');

    removeSavedWorkspace('D:/workspaces/My-Code-X');

    expect(listSavedWorkspaces()).toEqual([]);
    expect(getBootstrapIdentity()).toMatchObject({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-17',
    });
  });

  it('persists collaboration mode alongside the rest of runtime preferences per slot', () => {
    persistRuntimePreferences('slot-7', {
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      collaborationModeKind: 'plan',
    });

    expect(loadStoredRuntimePreferences('slot-7')).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'high',
      approvalPolicy: 'never',
      sandboxMode: 'danger-full-access',
      collaborationModeKind: 'plan',
    });
    expect(loadStoredRuntimePreferences('slot-8')).toBeNull();
  });

  it('reuses the slot from the URL during bootstrap', () => {
    setSlotUrl('slot-fixed');
    window.sessionStorage.setItem('my-code-x-viewer-id', 'viewer-ready');

    expect(getBootstrapIdentity()).toMatchObject({
      viewerId: 'viewer-ready',
      slotId: 'slot-fixed',
    });
  });

  it('creates a slot in the URL when one is missing', () => {
    const identity = getBootstrapIdentity();

    expect(identity.slotId).toMatch(/^slot-/);
    expect(new URL(window.location.href).searchParams.get('slot')).toBe(identity.slotId);
  });

  it('reads the bootstrap scope without creating a viewer id', () => {
    setSlotUrl('slot-ready');
    setActiveWorkspacePath('slot-ready', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-ready', 'thread-ready');

    expect(readBootstrapScope()).toEqual({
      slotId: 'slot-ready',
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
    });
    expect(window.sessionStorage.getItem('my-code-x-viewer-id')).toBeNull();
  });

  it('loads a terminal transcript cache only when the stored workspace matches the bootstrap scope', () => {
    setSlotUrl('slot-ready');
    setActiveWorkspacePath('slot-ready', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-ready', 'thread-ready');

    persistTranscriptCache({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Ready thread',
      latestTurn: createChatTurn('turn-ready', 'completed'),
      messages: [],
    });

    expect(loadBootstrapTranscriptCache()).toEqual({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Ready thread',
      latestTurn: createChatTurn('turn-ready', 'completed'),
      messages: [],
    });

    setActiveWorkspacePath('slot-ready', 'D:/workspaces/Other');

    expect(loadBootstrapTranscriptCache()).toBeNull();
  });

  it('restores interrupted transcript caches during bootstrap hydration', () => {
    setSlotUrl('slot-ready');
    setActiveWorkspacePath('slot-ready', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-ready', 'thread-ready');

    persistTranscriptCache({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Interrupted thread',
      latestTurn: createChatTurn('turn-interrupted', 'interrupted'),
      messages: [],
    });

    expect(loadBootstrapTranscriptCache()).toEqual({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Interrupted thread',
      latestTurn: createChatTurn('turn-interrupted', 'interrupted'),
      messages: [],
    });
  });

  it('ignores non-terminal transcript caches during bootstrap hydration', () => {
    setSlotUrl('slot-ready');
    setActiveWorkspacePath('slot-ready', 'D:/workspaces/My-Code-X');
    synchronizeStoredThreadId('slot-ready', 'thread-ready');

    persistTranscriptCache({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Running thread',
      latestTurn: createChatTurn('turn-running', 'inProgress'),
      messages: [],
    });

    expect(loadTranscriptCache('thread-ready')).toMatchObject({
      threadId: 'thread-ready',
      latestTurn: {
        status: 'inProgress',
      },
    });
    expect(loadBootstrapTranscriptCache()).toBeNull();
  });

  it('preserves a null active turn id when transcript cache round-trips through storage', () => {
    persistTranscriptCache({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Failed thread',
      latestTurn: createChatTurn('turn-failed', 'failed'),
      messages: [],
    });

    expect(loadTranscriptCache('thread-ready')).toEqual({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Failed thread',
      latestTurn: createChatTurn('turn-failed', 'failed'),
      messages: [],
    });
  });

  it('clears a transcript cache by thread id', () => {
    persistTranscriptCache({
      workspace: 'D:/workspaces/My-Code-X',
      threadId: 'thread-ready',
      threadName: 'Ready thread',
      latestTurn: createChatTurn('turn-ready', 'completed'),
      messages: [],
    });

    clearTranscriptCache('thread-ready');

    expect(loadTranscriptCache('thread-ready')).toBeNull();
  });
});


