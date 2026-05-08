function createPendingRequest({ id, method, kind, threadId = '', turnId = null, title, prompt, ...rest }) {
    return Object.fromEntries(Object.entries({
        id: String(id),
        method,
        kind,
        threadId,
        turnId,
        title,
        prompt,
        submitState: 'idle',
        ...rest,
    }).filter(([, value]) => value !== undefined));
}
function createCommandApprovalRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'command_approval',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            approvalId: params.approvalId,
            title: 'Approve command execution',
            prompt: params.command || params.reason || 'Review the pending command',
            command: params.command ?? '',
            cwd: params.cwd ?? '',
            reason: params.reason ?? null,
            commandActions: params.commandActions,
            availableDecisions: params.availableDecisions,
            networkApprovalContext: params.networkApprovalContext,
            raw: params,
        }),
    };
}
function createFileChangeApprovalRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'file_change_approval',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            title: 'Approve file changes',
            prompt: params.reason || 'Review the pending file changes',
            grantRoot: params.grantRoot ?? null,
            reason: params.reason ?? null,
            raw: params,
        }),
    };
}
function createPermissionsApprovalRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'permissions_approval',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            title: 'Approve permissions request',
            prompt: params.reason || 'Review the requested permissions',
            permissions: params.permissions ?? {},
            reason: params.reason ?? null,
            raw: params,
        }),
    };
}
function createLegacyPatchApprovalRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.conversationId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'legacy_patch_approval',
            threadId: params.conversationId,
            turnId: null,
            callId: params.callId,
            title: 'Approve patch changes',
            prompt: params.reason || 'Review the requested patch',
            fileChanges: params.fileChanges ?? {},
            grantRoot: params.grantRoot ?? null,
            reason: params.reason ?? null,
            raw: params,
        }),
    };
}
function createLegacyCommandApprovalRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.conversationId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'legacy_command_approval',
            threadId: params.conversationId,
            turnId: null,
            callId: params.callId,
            title: 'Approve command execution',
            prompt: Array.isArray(params.command) ? params.command.join(' ') : 'Review the pending command',
            command: Array.isArray(params.command) ? params.command.join(' ') : '',
            cwd: params.cwd ?? '',
            reason: params.reason ?? null,
            raw: params,
        }),
    };
}
function createUserInputRequest(requestId, method, params = {}) {
    const questionCount = Array.isArray(params.questions) ? params.questions.length : 0;
    const title = questionCount === 1 ? 'Answer 1 question' : `Answer ${questionCount} questions`;
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'user_input',
            threadId: params.threadId,
            turnId: params.turnId,
            itemId: params.itemId,
            title,
            prompt: '',
            questions: params.questions ?? [],
            raw: params,
        }),
    };
}
function createMcpElicitationRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'mcp_elicitation',
            threadId: params.threadId,
            turnId: params.turnId ?? null,
            title: 'MCP server input',
            prompt: params.message || 'Provide the requested MCP input',
            serverName: params.serverName,
            mode: params.mode,
            requestedSchema: params.requestedSchema,
            url: params.url,
            elicitationId: params.elicitationId,
            raw: params,
        }),
    };
}
function createToolCallRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: params.threadId,
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'tool_call',
            threadId: params.threadId,
            turnId: params.turnId,
            callId: params.callId,
            title: 'Dynamic tool call',
            prompt: params.tool || 'Provide the dynamic tool response',
            tool: params.tool,
            arguments: params.arguments,
            raw: params,
        }),
    };
}
function createAuthRefreshRequest(requestId, method, params = {}) {
    return {
        type: 'pending_request_updated',
        threadId: '',
        request: createPendingRequest({
            id: requestId,
            method,
            kind: 'auth_refresh',
            threadId: '',
            turnId: null,
            title: 'Refresh ChatGPT authentication',
            prompt: 'Codex needs refreshed ChatGPT credentials.',
            previousAccountId: params.previousAccountId ?? null,
            reason: params.reason ?? null,
            raw: params,
        }),
    };
}
const PENDING_REQUEST_EVENT_FACTORIES = {
    'item/commandExecution/requestApproval': createCommandApprovalRequest,
    'item/fileChange/requestApproval': createFileChangeApprovalRequest,
    'item/permissions/requestApproval': createPermissionsApprovalRequest,
    applyPatchApproval: createLegacyPatchApprovalRequest,
    execCommandApproval: createLegacyCommandApprovalRequest,
    'item/tool/requestUserInput': createUserInputRequest,
    'mcpServer/elicitation/request': createMcpElicitationRequest,
    'item/tool/call': createToolCallRequest,
    'account/chatgptAuthTokens/refresh': createAuthRefreshRequest,
};
export function mapCodexServerRequestToRuntimeEvent(requestId, method, params = {}) {
    const createEvent = PENDING_REQUEST_EVENT_FACTORIES[method];
    return typeof createEvent === 'function' ? createEvent(requestId, method, params) : null;
}
//# sourceMappingURL=codex-gateway-protocol-pending-requests.js.map