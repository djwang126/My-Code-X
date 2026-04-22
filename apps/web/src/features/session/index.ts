export { SessionGate } from './components/SessionGate';
export { SessionProvider, useSessionDispatch, useSessionState } from './context';
export { useSessionBootstrap } from './hooks/useSessionBootstrap';
export { useSessionSelection } from './selection';
export {
  getActiveWorkspacePath,
  getStoredThreadId,
  setActiveWorkspacePath,
  synchronizeStoredThreadId,
} from './lib/session-selection-storage';
export {
  SLOT_DISPLACED_MESSAGE,
  claimSlotOwnership,
  createSlotOwnershipStorageKey,
  getBootstrapIdentity,
  getPageOwnerInstanceId,
  isCurrentPageSlotOwner,
  parseSlotOwnershipRecord,
  readBootstrapScope,
  readSlotOwnership,
} from './scope';
