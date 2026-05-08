import { upsertPendingRequest } from '../shared/chat-session-state.js';
import { isRuntimeTurnActive } from './chat-turn-lifecycle.js';
import { createHttpError } from '../../../common/errors/http-error.js';
export function createSessionRegistry() {
    const runtimesBySlotId = new Map();
    const runtimesByThreadId = new Map();
    const threadlessRequestOwners = new Map();
    function hasThreadlessPendingRequests(runtime) {
        return Boolean(runtime?.pendingRequests.some((request) => !request.threadId));
    }
    function releaseRuntimeOwnership(runtime) {
        if (!runtime) {
            return;
        }
        runtimesBySlotId.delete(runtime.slotId);
        if (!runtime.threadId) {
            return;
        }
        const threadRuntime = runtimesByThreadId.get(runtime.threadId);
        if (threadRuntime?.slotId === runtime.slotId) {
            runtimesByThreadId.delete(runtime.threadId);
        }
    }
    function getConflictingThreadRuntime({ slotId, threadId }) {
        if (!threadId) {
            return null;
        }
        const runtime = runtimesByThreadId.get(threadId);
        return runtime && runtime.slotId !== slotId ? runtime : null;
    }
    function rebindThreadlessPendingRequests(sourceRuntime, targetRuntime) {
        if (!sourceRuntime || !targetRuntime || sourceRuntime === targetRuntime) {
            return;
        }
        const nextPendingRequests = [];
        for (const request of sourceRuntime.pendingRequests) {
            if (request.threadId) {
                nextPendingRequests.push(request);
                continue;
            }
            upsertPendingRequest(targetRuntime.pendingRequests, request);
            threadlessRequestOwners.set(request.id, targetRuntime.slotId);
        }
        sourceRuntime.pendingRequests = nextPendingRequests;
    }
    function findRuntimeContainingPendingRequest(requestId) {
        for (const runtime of runtimesBySlotId.values()) {
            if (runtime.pendingRequests.some((request) => request.id === requestId)) {
                return runtime;
            }
        }
        return null;
    }
    function storeRuntime(runtime) {
        const existingRuntime = runtimesBySlotId.get(runtime.slotId);
        if (existingRuntime?.threadId && existingRuntime.threadId !== runtime.threadId) {
            runtimesByThreadId.delete(existingRuntime.threadId);
        }
        runtimesBySlotId.set(runtime.slotId, runtime);
        if (runtime.threadId) {
            runtimesByThreadId.set(runtime.threadId, runtime);
        }
    }
    function getRuntimeBySlotId(slotId) {
        return slotId ? runtimesBySlotId.get(slotId) || null : null;
    }
    function getRuntimeByThreadId(threadId) {
        return threadId ? runtimesByThreadId.get(threadId) || null : null;
    }
    function getThreadlessRequestOwnerRuntime(requestId) {
        const ownerSlotId = threadlessRequestOwners.get(requestId);
        return ownerSlotId ? runtimesBySlotId.get(ownerSlotId) || null : null;
    }
    function pickThreadlessRequestRuntime() {
        const runtimes = Array.from(runtimesBySlotId.values());
        if (!runtimes.length) {
            return null;
        }
        const activeRuntimes = runtimes.filter(runtime => isRuntimeTurnActive(runtime));
        const candidateRuntimes = activeRuntimes.length ? activeRuntimes : runtimes;
        return candidateRuntimes.reduce((selectedRuntime, runtime) => {
            if (!selectedRuntime) {
                return runtime;
            }
            return runtime.lastUpdatedAt >= selectedRuntime.lastUpdatedAt ? runtime : selectedRuntime;
        }, null);
    }
    function getRuntimeForThreadlessRequestEvent(event) {
        if (event.type === 'pending_request_updated') {
            const runtime = getThreadlessRequestOwnerRuntime(event.request.id) || pickThreadlessRequestRuntime();
            if (runtime) {
                threadlessRequestOwners.set(event.request.id, runtime.slotId);
            }
            return runtime;
        }
        if (event.type === 'pending_request_resolved') {
            const runtime = getThreadlessRequestOwnerRuntime(event.requestId) || findRuntimeContainingPendingRequest(event.requestId);
            if (runtime) {
                threadlessRequestOwners.set(event.requestId, runtime.slotId);
            }
            return runtime;
        }
        return null;
    }
    function getTargetRuntimesForEvent(event) {
        if (event.threadId) {
            const runtime = getRuntimeByThreadId(event.threadId);
            return runtime ? [runtime] : [];
        }
        if (event.type === 'pending_request_updated' || event.type === 'pending_request_resolved') {
            const runtime = getRuntimeForThreadlessRequestEvent(event);
            return runtime ? [runtime] : [];
        }
        return [];
    }
    function getRuntimeForSelection({ slotId, threadId }) {
        const runtime = threadId ? getRuntimeByThreadId(threadId) : (slotId ? getRuntimeBySlotId(slotId) : null);
        if (!runtime) {
            return null;
        }
        return slotId && runtime.slotId !== slotId ? null : runtime;
    }
    function getIdleRuntimeForThreadAction({ slotId, threadId }) {
        const runtime = getRuntimeForSelection({ slotId, threadId });
        if (!runtime) {
            throw createHttpError('thread not found', 404);
        }
        if (isRuntimeTurnActive(runtime)) {
            throw createHttpError('turn already in progress', 409);
        }
        return runtime;
    }
    function findRuntimeForPendingRequest({ requestId, threadId, fallbackRuntime = null, }) {
        if (threadId) {
            return getRuntimeByThreadId(threadId) || findRuntimeContainingPendingRequest(requestId) || fallbackRuntime;
        }
        return getThreadlessRequestOwnerRuntime(requestId) || findRuntimeContainingPendingRequest(requestId) || fallbackRuntime;
    }
    return {
        hasThreadlessPendingRequests,
        releaseRuntimeOwnership,
        getConflictingThreadRuntime,
        rebindThreadlessPendingRequests,
        findRuntimeForPendingRequest,
        storeRuntime,
        getRuntimeBySlotId,
        getTargetRuntimesForEvent,
        getRuntimeForSelection,
        getIdleRuntimeForThreadAction,
        listRuntimes() {
            return Array.from(runtimesBySlotId.values());
        },
        deleteThreadlessRequestOwner(requestId) {
            threadlessRequestOwners.delete(requestId);
        },
    };
}
//# sourceMappingURL=chat-session-registry.js.map