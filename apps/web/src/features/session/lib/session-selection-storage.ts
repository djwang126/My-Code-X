import {
  clearSlotScopedStorageValue,
  persistSlotScopedStorageValue,
  readSlotScopedStorageValue,
} from '../../../shared/lib/slot-scoped-storage';
import { normalizeWorkspacePath } from '../../../shared/lib/workspace-path';

const activeWorkspaceStorageSuffix = 'active-workspace';
const threadStorageSuffix = 'thread-id';

export function getActiveWorkspacePath(slotId: string) {
  return readSlotScopedStorageValue(slotId, activeWorkspaceStorageSuffix) || '';
}

export function getStoredThreadId(slotId: string) {
  return readSlotScopedStorageValue(slotId, threadStorageSuffix) || '';
}

export function synchronizeStoredThreadId(slotId: string, threadId: string) {
  if (threadId) {
    persistSlotScopedStorageValue(slotId, threadStorageSuffix, threadId);
    return;
  }

  clearSlotScopedStorageValue(slotId, threadStorageSuffix);
}

export function setActiveWorkspacePath(slotId: string, path: string) {
  const normalizedPath = normalizeWorkspacePath(path);

  if (!normalizedPath) {
    clearSlotScopedStorageValue(slotId, activeWorkspaceStorageSuffix);
    clearSlotScopedStorageValue(slotId, threadStorageSuffix);
    return;
  }

  persistSlotScopedStorageValue(slotId, activeWorkspaceStorageSuffix, normalizedPath);
  clearSlotScopedStorageValue(slotId, threadStorageSuffix);
}
