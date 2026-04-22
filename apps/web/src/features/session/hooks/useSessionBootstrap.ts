import { useCallback, useEffect, useRef } from 'react';

import { resolveBootstrapCollaborationModeKind } from '../../../shared/lib/collaboration-mode';
import { SessionApiError } from '../../../shared/lib/app-api-client';
import {
  applySessionRuntimeMetadata,
  loadStoredRuntimePreferences,
  mergeRuntimeSettings,
  persistRuntimePreferences,
  readRuntimeSettings,
} from '../../runtime-settings';
import {
  SLOT_DISPLACED_MESSAGE,
  claimSlotOwnership,
  createSlotOwnershipStorageKey,
  getBootstrapIdentity,
  getPageOwnerInstanceId,
  isCurrentPageSlotOwner,
  parseSlotOwnershipRecord,
} from '../scope';
import { fetchSessionPayload } from '../../chat-runtime/bootstrap';
import { useChatRuntimeDispatch } from '../../chat-runtime/context';
import { useSessionDispatch } from '../context';
import { useSessionSelection } from '../selection';

export function useSessionBootstrap({ autoStart = true }: { autoStart?: boolean } = {}) {
  const dispatch = useSessionDispatch();
  const chatDispatch = useChatRuntimeDispatch();
  const { selectThread, selectWorkspace } = useSessionSelection();
  const bootstrapRequestIdRef = useRef(0);
  const bootstrapLifecycleIdRef = useRef(0);
  const trackedSlotIdRef = useRef(getBootstrapIdentity().slotId);

  const invalidateBootstrap = useCallback(() => {
    bootstrapRequestIdRef.current += 1;
  }, []);

  const resetChatRuntime = useCallback(
    ({ workspace, threadId }: { workspace: string; threadId: string }) => {
      chatDispatch({ type: 'bootstrap/reset', workspace, threadId });
    },
    [chatDispatch],
  );

  const dispatchSlotDisplaced = useCallback(
    (slotId: string) => {
      invalidateBootstrap();
      resetChatRuntime({ workspace: '', threadId: '' });
      dispatch({
        type: 'slot/displaced',
        viewerId: getBootstrapIdentity().viewerId,
        slotId,
        errorMessage: SLOT_DISPLACED_MESSAGE,
      });
    },
    [dispatch, invalidateBootstrap, resetChatRuntime],
  );

  const bootstrap = useCallback(
    ({
      resetPhase,
      identityOverride = null,
      claimOwnership = false,
    }: {
      resetPhase: boolean;
      identityOverride?: ReturnType<typeof getBootstrapIdentity> | null;
      claimOwnership?: boolean;
    }) => {
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
            resetChatRuntime({ workspace, threadId });
          }

          return fetchSessionPayload({ viewerId, slotId, workspace, threadId });
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

          const storedRuntimePreferences = loadStoredRuntimePreferences(slotId);
          const mergedRuntimeSettings = mergeRuntimeSettings({
            defaults: readRuntimeSettings(payload.preferences),
            stored: storedRuntimePreferences,
          });
          const nextCollaborationModeKind = resolveBootstrapCollaborationModeKind({
            threadId: payload.session.threadId,
            payloadKind: payload.session.collaborationModeKind,
            storedKind: storedRuntimePreferences?.collaborationModeKind,
          });
          const nextRuntimeSettings = applySessionRuntimeMetadata(mergedRuntimeSettings, {
            collaborationModeKind: nextCollaborationModeKind,
            ...(Object.prototype.hasOwnProperty.call(payload.session, 'promptOverride')
              ? { promptOverride: payload.session.promptOverride }
              : {}),
          });
          const nextPayload = nextRuntimeSettings
            ? {
                ...payload,
                preferences: nextRuntimeSettings,
              }
            : payload;

          if (nextRuntimeSettings) {
            persistRuntimePreferences(slotId, nextRuntimeSettings);
          }

          selectThread({ workspace: payload.session.workspace, threadId: payload.session.threadId });
          dispatch({
            type: 'bootstrap/succeeded',
            viewerId: payload.viewer.viewerId,
            slotId: payload.viewer.slotId,
            workspace: payload.session.workspace,
            threadId: payload.session.threadId,
            serverInstanceId: payload.server.serverInstanceId,
          });
          chatDispatch({ type: 'bootstrap/succeeded', payload: nextPayload });
        })
        .catch(error => {
          const { viewerId, slotId, workspace, threadId } = resolvedIdentity;
          if (requestId !== bootstrapRequestIdRef.current || lifecycleId !== bootstrapLifecycleIdRef.current) {
            return;
          }

          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }

          resetChatRuntime({ workspace, threadId });

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
    [chatDispatch, dispatch, dispatchSlotDisplaced, resetChatRuntime, selectThread],
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
    ({ workspace, threadId }: { workspace: string; threadId: string }) => {
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
