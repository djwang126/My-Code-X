import { isSessionExecutionActive } from '@my-code-x/contracts';
import type { LooseRecord } from './codex-types.js';
export function canShutdownCodexForIdle({ activitySnapshot }: {
    activitySnapshot?: LooseRecord;
} = {}) {
    const sessions = Array.isArray(activitySnapshot?.sessions) ? activitySnapshot.sessions : [];
    return sessions.every((session: any) => {
        if (isSessionExecutionActive(session.turnExecution)) {
            return false;
        }
        return session.pendingRequestCount === 0;
    });
}
