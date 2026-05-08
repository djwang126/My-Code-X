import { persistSessionStorageValue, readSessionStorageValue } from '../../../../shared/lib/browser-storage';

const dismissedProposedPlanActionStoragePrefix = 'my-code-x-dismissed-proposed-plan-action:';

function createDismissedProposedPlanActionStorageKey(threadId: string, turnId: string) {
  return `${dismissedProposedPlanActionStoragePrefix}${threadId}:${turnId}`;
}

export function dismissProposedPlanAction(threadId: string, turnId: string) {
  if (!threadId || !turnId) {
    return;
  }

  persistSessionStorageValue(createDismissedProposedPlanActionStorageKey(threadId, turnId), '1');
}

export function isProposedPlanActionDismissed(threadId: string, turnId: string) {
  if (!threadId || !turnId) {
    return false;
  }

  return readSessionStorageValue(createDismissedProposedPlanActionStorageKey(threadId, turnId)) === '1';
}
