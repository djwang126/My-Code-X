import { createHttpError } from '../../../common/errors/http-error.js';
export function createPendingRequestService({ codexGateway, now, registry, emitter }) {
    async function respondToPendingRequest({ slotId, threadId, requestId, response }) {
        const runtime = registry.getRuntimeForSelection({ slotId, threadId });
        if (!runtime) {
            throw createHttpError('thread not found', 404);
        }
        const pendingRequest = runtime.pendingRequests.find((request) => request.id === requestId);
        if (!pendingRequest) {
            throw createHttpError('request not found', 409);
        }
        if (pendingRequest.submitState === 'submitting') {
            throw createHttpError('request already submitting', 409);
        }
        pendingRequest.submitState = 'submitting';
        runtime.lastUpdatedAt = now();
        emitter.emitPendingRequestUpdated(runtime, pendingRequest);
        try {
            return await codexGateway.respondToRequest({ requestId, response });
        }
        catch (error) {
            const currentRuntime = registry.findRuntimeForPendingRequest({
                requestId,
                threadId: pendingRequest.threadId,
                fallbackRuntime: runtime,
            });
            const currentPendingRequest = currentRuntime?.pendingRequests.find((request) => request.id === requestId);
            if (currentRuntime && currentPendingRequest) {
                currentPendingRequest.submitState = 'idle';
                currentRuntime.lastUpdatedAt = now();
                emitter.emitPendingRequestUpdated(currentRuntime, currentPendingRequest);
            }
            throw error;
        }
    }
    return {
        respondToPendingRequest,
    };
}
//# sourceMappingURL=pending-request.service.js.map