import { isChatTurnActive } from '@my-code-x/contracts';
import type { LooseRecord } from './codex-types.js';
export function canShutdownCodexForIdle({ activitySnapshot }: {
    activitySnapshot?: LooseRecord;
} = {}) {
    const sessions = Array.isArray(activitySnapshot?.sessions) ? activitySnapshot.sessions : [];
    return sessions.every((session: any) => {
        if (isChatTurnActive(session.latestTurn)) {
            return false;
        }
        return session.pendingRequestCount === 0;
    });
}
