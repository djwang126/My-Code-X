import { useCallback, useEffect, useRef } from 'react';

import { SessionApiError } from '../../../shared/lib/app-api-client';
import {
  SLOT_DISPLACED_MESSAGE,
  claimSlotOwnership,
  createSlotOwnershipStorageKey,
  getBootstrapIdentity,
  getPageOwnerInstanceId,
  isCurrentPageSlotOwner,
  parseSlotOwnershipRecord,
} from '../scope';
import { useSessionDispatch } from '../context';
import { useSessionSelection } from '../selection';

type SessionBootstrapFetchInput = {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
};

type SessionBootstrapSelectionInput = {
  workspace: string;
  threadId: string;
};

type SessionBootstrapSucceededInput = {
  viewerId: string;
  slotId: string;
  workspace: string;
  threadId: string;
  serverInstanceId: string;
};

type SessionBootstrapStateResetInput = {
  workspace: string;
  threadId: string;
};

type ApplySessionBootstrapPayloadInput<TPayload> = {
  payload: TPayload;
  selectThread: (input: SessionBootstrapSelectionInput) => void;
  dispatchSessionBootstrapSucceeded: (input: SessionBootstrapSucceededInput) => void;
};

type UseSessionBootstrapOptions<TPayload> = {
  autoStart?: boolean;
  fetchBootstrapPayload: (input: SessionBootstrapFetchInput) => Promise<TPayload>;
  resetBootstrapState: (input: SessionBootstrapStateResetInput) => void;
  applyBootstrapPayload: (input: ApplySessionBootstrapPayloadInput<TPayload>) => void;
};

type BootstrapIdentityOverride = ReturnType<typeof getBootstrapIdentity> | null;

type BootstrapRunInput = {
  resetPhase: boolean;
  identityOverride?: BootstrapIdentityOverride;
  claimOwnership?: boolean;
};

type ResumeThreadInput = {
  workspace: string;
  threadId: string;
};

export function useSessionBootstrap<TPayload>({
  autoStart = true,
  fetchBootstrapPayload,
  resetBootstrapState,
  applyBootstrapPayload,
}: UseSessionBootstrapOptions<TPayload>) {
  const dispatch = useSessionDispatch();
  const { selectThread, selectWorkspace } = useSessionSelection();
  const bootstrapRequestIdRef = useRef(0);
  const bootstrapLifecycleIdRef = useRef(0);
  const trackedSlotIdRef = useRef(getBootstrapIdentity().slotId);

  const invalidateBootstrap = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
  }, []);

  const dispatchSlotDisplaced = useCallback(
    (slotId: string) => {
      invalidateBootstrap();
      resetBootstrapState({ workspace: '', threadId: '' });
      dispatch({
        type: 'slot/displaced',
        viewerId: getBootstrapIdentity().viewerId,
        slotId,
        errorMessage: SLOT_DISPLACED_MESSAGE,
      });
    },
    [dispatch, invalidateBootstrap, resetBootstrapState],
  );

  const bootstrap = useCallback(
    ({
      resetPhase,
      identityOverride = null,
      claimOwnership = false,
    }: BootstrapRunInput) => {
      const resolvedIdentity = identityOverride ?? getBootstrapIdentity();
      const requestId = ++bootstrapRequestIdRef.current;
      const lifecycleId = bootstrapLifecycleIdRef.current;

      Promise.resolve()
        .then(() => {
          if (requestId !== bootstrapRequestIdRef.current || lifecycleId !== bootstrapLifecycleIdRef.current) {
            return;
          }

          const { viewerId, slotId, workspace, threadId } = resolvedIdentity;
          trackedSlotIdRef.current = slotId;

          if (claimOwnership) {
            claimSlotOwnership(slotId);
          }

          if (resetPhase) {
            dispatch({ type: 'bootstrap/started', viewerId, slotId, workspace, threadId });
            resetBootstrapState({ workspace, threadId });
          }

          return fetchBootstrapPayload({ viewerId, slotId, workspace, threadId });
        })
        .then(payload => {
          if (!payload) {
            return;
          }

          const { slotId } = resolvedIdentity;
          if (requestId !== bootstrapRequestIdRef.current || lifecycleId !== bootstrapLifecycleIdRef.current) {
            return;
          }

          if (!isCurrentPageSlotOwner(slotId)) {
            dispatchSlotDisplaced(slotId);
            return;
          }

          applyBootstrapPayload({
            payload,
            selectThread,
            dispatchSessionBootstrapSucceeded: input =>
              dispatch({
                type: 'bootstrap/succeeded',
                ...input,
              }),
          });
        })
        .catch(error => {
          const { viewerId, slotId, workspace, threadId } = resolvedIdentity;
          if (requestId !== bootstrapRequestIdRef.current || lifecycleId !== bootstrapLifecycleIdRef.current) {
            return;
          }

          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

          resetBootstrapState({ workspace, threadId });

          if (error instanceof SessionApiError && (error.status === 401 || error.code === 'unauthorized')) {
            dispatch({ type: 'bootstrap/auth-required', viewerId, slotId });
            return;
          }

          dispatch({
            type: 'bootstrap/failed',
            viewerId,
            slotId,
            errorMessage: error instanceof Error ? error.message : 'unknown_error',
          });
        });
    },
    [applyBootstrapPayload, dispatch, dispatchSlotDisplaced, fetchBootstrapPayload, resetBootstrapState, selectThread],
  );

  const startFresh = useCallback(() => {
    const identity = getBootstrapIdentity();
    selectThread({ workspace: identity.workspace, threadId: '' });
    bootstrap({
      resetPhase: true,
      identityOverride: {
        ...identity,
        threadId: '',
      },
      claimOwnership: true,
    });
  }, [bootstrap, selectThread]);

  const retryBootstrap = useCallback(() => {
    bootstrap({ resetPhase: true, claimOwnership: true });
  }, [bootstrap]);

  const openWorkspace = useCallback(
    (workspace: string) => {
      const identity = getBootstrapIdentity();
      selectWorkspace(workspace);
      bootstrap({
        resetPhase: true,
        identityOverride: {
          ...identity,
          workspace,
          threadId: '',
        },
        claimOwnership: true,
      });
    },
    [bootstrap, selectWorkspace],
  );

  const resumeWorkspace = useCallback(
    (workspace: string) => {
      const identity = getBootstrapIdentity();
      selectWorkspace(workspace);
      bootstrap({
        resetPhase: true,
        identityOverride: {
          ...identity,
          workspace,
          threadId: '',
        },
        claimOwnership: true,
      });
    },
    [bootstrap, selectWorkspace],
  );

  const resumeThread = useCallback(
    ({ workspace, threadId }: ResumeThreadInput) => {
      const identity = getBootstrapIdentity();
      selectThread({ workspace, threadId });
      bootstrap({
        resetPhase: true,
        identityOverride: {
          ...identity,
          workspace,
          threadId,
        },
        claimOwnership: true,
      });
    },
    [bootstrap, selectThread],
  );

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    bootstrapLifecycleIdRef.current += 1;
    const lifecycleId = bootstrapLifecycleIdRef.current;
    const ownerInstanceId = getPageOwnerInstanceId();

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        return;
      }

      bootstrap({ resetPhase: false, claimOwnership: true });
    }

    function handleStorageEvent(event: StorageEvent) {
      const slotId = trackedSlotIdRef.current;
      if (!slotId || event.key !== createSlotOwnershipStorageKey(slotId)) {
        return;
      }

      const ownership = parseSlotOwnershipRecord({
        raw: event.newValue,
        slotId,
      });

      if (!ownership || ownership.ownerInstanceId === ownerInstanceId) {
        return;
      }

      dispatchSlotDisplaced(slotId);
    }

    bootstrap({ resetPhase: true, claimOwnership: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (lifecycleId === bootstrapLifecycleIdRef.current) {
        bootstrapLifecycleIdRef.current += 1;
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [autoStart, bootstrap, dispatchSlotDisplaced]);

  return { startFresh, retryBootstrap, openWorkspace, resumeWorkspace, resumeThread };
}
