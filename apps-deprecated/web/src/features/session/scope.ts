export type { BootstrapIdentity, BootstrapScope } from './lib/session-identity';
export type { SlotOwnershipRecord } from './lib/slot-ownership';
export {
  getBootstrapIdentity,
  readBootstrapScope,
} from './lib/session-identity';
export {
  SLOT_DISPLACED_MESSAGE,
  claimSlotOwnership,
  createSlotOwnershipStorageKey,
  getPageOwnerInstanceId,
  isCurrentPageSlotOwner,
  parseSlotOwnershipRecord,
  readSlotOwnership,
} from './lib/slot-ownership';
