import type { ChatEventEmitter, ChatSessionRegistry } from '../shared/chat-types.js';
import { applyGatewayEventToRuntime } from './chat-event-applier.handlers.js';
import type { LooseRecord } from '../../../common/codex/codex-types.js';

export function createChatEventApplier({
  now,
  registry,
  emitter,
}: {
  now: () => string;
  registry: ChatSessionRegistry;
  emitter: ChatEventEmitter;
}) {
  function applyGatewayEvent(event: LooseRecord) {
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
