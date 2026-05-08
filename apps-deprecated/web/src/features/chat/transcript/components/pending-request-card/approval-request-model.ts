import type { SessionPendingRequest, SessionPendingRequestApprovalDecision } from '../../../runtime/public-types';

export interface ApprovalDecisionOption {
  label: string;
  value: SessionPendingRequestApprovalDecision;
}

export function isPrimaryApprovalDecision(decision: SessionPendingRequestApprovalDecision) {
  return decision === 'accept' || decision === 'approved';
}

export function getApprovalDecisionLabel(decision: SessionPendingRequestApprovalDecision) {
  if (decision === 'accept' || decision === 'approved') {
    return 'Approve';
  }

  if (decision === 'acceptForSession' || decision === 'approved_for_session') {
    return 'Approve for session';
  }

  if (decision === 'decline' || decision === 'denied') {
    return 'Deny';
  }

  if (decision === 'cancel' || decision === 'abort') {
    return 'Cancel';
  }

  if (decision && typeof decision === 'object') {
    if ('acceptWithExecpolicyAmendment' in decision) {
      return 'Approve with policy amendment';
    }

    if ('applyNetworkPolicyAmendment' in decision) {
      return 'Apply network policy amendment';
    }
  }

  return 'Respond';
}

export function getApprovalDecisionOptions(request: SessionPendingRequest): ApprovalDecisionOption[] {
  const availableDecisions = Array.isArray(request.availableDecisions)
    ? request.availableDecisions
    : Array.isArray(request.raw?.availableDecisions)
      ? (request.raw.availableDecisions as SessionPendingRequestApprovalDecision[])
      : null;

  if (availableDecisions?.length) {
    return availableDecisions.map(decision => ({
      label: getApprovalDecisionLabel(decision),
      value: decision,
    }));
  }

  if (request.kind === 'legacy_patch_approval' || request.kind === 'legacy_command_approval') {
    return [
      { label: 'Approve', value: 'approved' },
      { label: 'Approve for session', value: 'approved_for_session' },
      { label: 'Deny', value: 'denied' },
      { label: 'Abort', value: 'abort' },
    ];
  }

  if (request.kind === 'permissions_approval') {
    return [
      { label: 'Approve', value: 'accept' },
      { label: 'Approve for session', value: 'acceptForSession' },
      { label: 'Deny', value: 'decline' },
    ];
  }

  return [
    { label: 'Approve', value: 'accept' },
    { label: 'Approve for session', value: 'acceptForSession' },
    { label: 'Deny', value: 'decline' },
    { label: 'Cancel', value: 'cancel' },
  ];
}

export function getApprovalResponsePayload({
  request,
  decision,
}: {
  request: SessionPendingRequest;
  decision: SessionPendingRequestApprovalDecision;
}) {
  if (request.kind === 'permissions_approval') {
    if (decision === 'acceptForSession') {
      return { permissions: request.permissions ?? {}, scope: 'session' };
    }

    if (decision === 'accept') {
      return { permissions: request.permissions ?? {} };
    }

    return { permissions: {} };
  }

  return { decision };
}
