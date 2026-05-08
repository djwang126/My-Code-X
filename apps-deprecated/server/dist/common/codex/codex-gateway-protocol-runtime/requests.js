import { createCollaborationModeSettings } from './collaboration-mode.js';
import { sanitizeRuntimeSettings, readThreadScopedRuntimeConfig, readOptionalPossiblyEmptyString } from './shared.js';
const codexClientInfo = {
    name: 'codex_vscode',
    title: 'Codex VS Code Extension',
    version: '0.1.0',
};
function createSandboxPolicyFromMode(sandboxMode) {
    switch (sandboxMode) {
        case 'read-only':
            return { type: 'readOnly' };
        case 'workspace-write':
            return { type: 'workspaceWrite' };
        case 'danger-full-access':
        default:
            return { type: 'dangerFullAccess' };
    }
}
function normalizeTurnInputContent(content, text) {
    if (Array.isArray(content) && content.length) {
        return content.map((item) => {
            if (item?.type === 'text') {
                return {
                    type: 'text',
                    text: item.text,
                    text_elements: Array.isArray(item.text_elements) ? item.text_elements : [],
                };
            }
            return item;
        });
    }
    return [{ type: 'text', text, text_elements: [] }];
}
function buildThreadRequestBase({ cwd, runtimeSettings }) {
    const settings = sanitizeRuntimeSettings(runtimeSettings);
    const config = readThreadScopedRuntimeConfig(runtimeSettings);
    return Object.fromEntries(Object.entries({
        cwd,
        model: settings.model,
        approvalPolicy: settings.approvalPolicy,
        sandbox: settings.sandboxMode,
        config,
        persistExtendedHistory: true,
    }).filter(([, value]) => value !== undefined));
}
export function createThreadRequestDefaults(cwd, runtimeSettings) {
    return buildThreadRequestBase({ cwd, runtimeSettings });
}
export function createTurnRequestDefaults({ cwd, runtimeSettings }) {
    const settings = sanitizeRuntimeSettings(runtimeSettings);
    return Object.fromEntries(Object.entries({
        cwd,
        model: settings.model,
        effort: settings.reasoningEffort,
        summary: settings.reasoningSummary,
        approvalPolicy: settings.approvalPolicy,
        sandboxPolicy: settings.sandboxMode ? createSandboxPolicyFromMode(settings.sandboxMode) : undefined,
    }).filter(([, value]) => value !== undefined));
}
export function createInitializeParams() {
    return {
        clientInfo: codexClientInfo,
        capabilities: {
            experimentalApi: true,
        },
    };
}
export function createStartThreadParams({ cwd, dynamicToolSpecs = [], runtimeSettings, baseInstructions, } = {}) {
    return Object.fromEntries(Object.entries({
        ...buildThreadRequestBase({ cwd, runtimeSettings }),
        baseInstructions: readOptionalPossiblyEmptyString(baseInstructions),
        dynamicTools: Array.isArray(dynamicToolSpecs) && dynamicToolSpecs.length ? dynamicToolSpecs : undefined,
    }).filter(([, value]) => value !== undefined));
}
export function createResumeThreadParams({ threadId, cwd, runtimeSettings, baseInstructions, } = {}) {
    return Object.fromEntries(Object.entries({
        threadId,
        ...buildThreadRequestBase({ cwd, runtimeSettings }),
        baseInstructions: readOptionalPossiblyEmptyString(baseInstructions),
    }).filter(([, value]) => value !== undefined));
}
export function createForkThreadParams({ threadId, cwd, runtimeSettings, baseInstructions, } = {}) {
    return Object.fromEntries(Object.entries({
        threadId,
        ...buildThreadRequestBase({ cwd, runtimeSettings }),
        baseInstructions: readOptionalPossiblyEmptyString(baseInstructions),
    }).filter(([, value]) => value !== undefined));
}
export function createStartTurnParams({ threadId, text, content, cwd, runtimeSettings, runtimePreferences, collaborationMode, } = {}) {
    return Object.fromEntries(Object.entries({
        threadId,
        input: normalizeTurnInputContent(content, text),
        ...createTurnRequestDefaults({ cwd, runtimeSettings }),
        collaborationMode: createCollaborationModeSettings({ collaborationMode, runtimeSettings, runtimePreferences }),
    }).filter(([, value]) => value !== undefined));
}
//# sourceMappingURL=requests.js.map