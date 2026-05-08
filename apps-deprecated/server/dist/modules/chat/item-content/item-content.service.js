import { createHttpError } from '../../../common/errors/http-error.js';
import { readTimelineItemContentPayload } from '../contracts/timeline-item.contract.js';
export function createItemContentService({ registry }) {
    async function getTimelineItemContent({ slotId, threadId, itemId }) {
        const runtime = registry.getRuntimeForSelection({ slotId, threadId });
        if (!runtime) {
            throw createHttpError('thread not found', 404);
        }
        const item = runtime.messages.find((message) => message.id === itemId);
        if (!item || item.kind !== 'special') {
            throw createHttpError('timeline item not found', 404);
        }
        const payload = readTimelineItemContentPayload(item);
        if (!payload) {
            throw createHttpError('timeline item content not found', 404);
        }
        return payload;
    }
    return {
        getTimelineItemContent,
    };
}
//# sourceMappingURL=item-content.service.js.map