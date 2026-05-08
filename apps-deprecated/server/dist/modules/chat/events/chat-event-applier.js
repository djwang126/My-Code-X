import { applyGatewayEventToRuntime } from './chat-event-applier.handlers.js';
export function createChatEventApplier({ now, registry, emitter, }) {
    function applyGatewayEvent(event) {
        const targetRuntimes = registry.getTargetRuntimesForEvent(event);
        if (!targetRuntimes.length) {
            return;
        }
        for (const runtime of targetRuntimes) {
            applyGatewayEventToRuntime(runtime, event, { now, registry, emitter });
        }
    }
    return {
        applyGatewayEvent,
    };
}
//# sourceMappingURL=chat-event-applier.js.map