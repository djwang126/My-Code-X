import { isSessionExecutionActive } from '@my-code-x/contracts';
export function canShutdownCodexForIdle({ activitySnapshot } = {}) {
    const sessions = Array.isArray(activitySnapshot?.sessions) ? activitySnapshot.sessions : [];
    return sessions.every((session) => {
        if (isSessionExecutionActive(session.turnExecution)) {
            return false;
        }
        return session.pendingRequestCount === 0;
    });
}
//# sourceMappingURL=codex-idle-shutdown-policy.js.map