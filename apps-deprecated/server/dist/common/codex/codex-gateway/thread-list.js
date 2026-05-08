import { normalizeThreadListResult } from '../codex-gateway-protocol.js';
import { buildCodexWorkspacePathStrategy } from '../codex-workspace-path.js';
import { logWorkspacePathDebug } from './workspace-path-debug.js';
export async function listThreadsWithWorkspaceFallback({ archived = false, limit = 20, transport, workspace, workspacePathDebugEnabled, }) {
    const { queryCandidates } = buildCodexWorkspacePathStrategy(workspace);
    const candidates = queryCandidates.length ? queryCandidates : [null];
    logWorkspacePathDebug(workspacePathDebugEnabled, {
        action: 'thread_list_started',
        workspace: String(workspace || '').trim(),
        archived,
        limit,
        candidates,
    });
    for (const [candidateIndex, candidate] of candidates.entries()) {
        const result = await transport.sendRequest('thread/list', {
            limit,
            sortKey: 'updated_at',
            archived,
            ...(candidate ? { cwd: candidate } : {}),
        });
        const threads = normalizeThreadListResult(result)
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .slice(0, Math.max(1, limit));
        logWorkspacePathDebug(workspacePathDebugEnabled, {
            action: 'thread_list_candidate_completed',
            workspace: String(workspace || '').trim(),
            archived,
            candidateIndex,
            candidate,
            resultCount: threads.length,
            usedFallback: candidateIndex > 0,
        });
        if (threads.length) {
            logWorkspacePathDebug(workspacePathDebugEnabled, {
                action: 'thread_list_completed',
                workspace: String(workspace || '').trim(),
                archived,
                selectedCandidate: candidate,
                selectedCandidateIndex: candidateIndex,
                resultCount: threads.length,
                fallbackTriggered: candidateIndex > 0,
            });
            return threads;
        }
    }
    logWorkspacePathDebug(workspacePathDebugEnabled, {
        action: 'thread_list_completed',
        workspace: String(workspace || '').trim(),
        archived,
        selectedCandidate: null,
        selectedCandidateIndex: -1,
        resultCount: 0,
        fallbackTriggered: candidates.length > 1,
    });
    return [];
}
//# sourceMappingURL=thread-list.js.map