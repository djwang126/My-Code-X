import { persistSessionStorageValue, readSessionStorageValue } from '../../../shared/lib/browser-storage';
import { getActiveWorkspacePath, getStoredThreadId } from './session-selection-storage';

const viewerStorageKey = 'my-code-x-viewer-id';
const slotSearchParam = 'slot';

export type BootstrapScope = {
  slotId: string;
  workspace: string;
  threadId: string;
};

export type BootstrapIdentity = BootstrapScope & {
  viewerId: string;
};

function normalizeStorageId(value: string | null | undefined) {
  return String(value || '').trim();
}

function createScopedId(prefix: string) {
  const fromUuid = window.crypto?.randomUUID?.();
  if (fromUuid) {
    return `${prefix}-${fromUuid}`;
  }

  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const randomPart = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function createSlotId() {
  return createScopedId('slot');
}

function getOrCreateViewerId() {
  const saved = readSessionStorageValue(viewerStorageKey);
  if (saved) {
    return saved;
  }

  const nextViewerId = createScopedId('viewer');
  persistSessionStorageValue(viewerStorageKey, nextViewerId);
  return nextViewerId;
}

function readUrlSlotId() {
  try {
    const url = new URL(window.location.href);
    return normalizeStorageId(url.searchParams.get(slotSearchParam));
  } catch {
    return '';
  }
}

function persistUrlSlotId(slotId: string) {
  if (!slotId) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(slotSearchParam) === slotId) {
      return;
    }

    url.searchParams.set(slotSearchParam, slotId);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Ignore URL persistence failures and keep the in-memory slot id.
  }
}

function getCurrentSlotId() {
  const urlSlotId = readUrlSlotId();
  if (urlSlotId) {
    return urlSlotId;
  }

  const nextSlotId = createSlotId();
  persistUrlSlotId(nextSlotId);
  return nextSlotId;
}

export function readBootstrapScope(): BootstrapScope {
  const slotId = getCurrentSlotId();

  return {
    slotId,
    workspace: getActiveWorkspacePath(slotId),
    threadId: getStoredThreadId(slotId),
  };
}

export function getBootstrapIdentity(): BootstrapIdentity {
  const scope = readBootstrapScope();

  return {
    viewerId: getOrCreateViewerId(),
    slotId: scope.slotId,
    workspace: scope.workspace,
    threadId: scope.threadId,
  };
}
