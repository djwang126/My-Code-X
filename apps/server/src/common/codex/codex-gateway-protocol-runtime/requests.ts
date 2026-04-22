import { createCollaborationModeSettings } from './collaboration-mode.js';
import { sanitizeRuntimeSettings, readThreadScopedRuntimeConfig, readOptionalPossiblyEmptyString } from './shared.js';
import type { CollaborationModePreset, LooseRecord, RuntimePreferences, RuntimeSettings, } from '../codex-types.js';
const codexClientInfo = {
    name: 'codex_vscode',
    title: 'Codex VS Code Extension',
    version: '0.1.0',
};
function createSandboxPolicyFromMode(sandboxMode: any) {
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
function normalizeTurnInputContent(content: any, text: any) {
    if (Array.isArray(content) && content.length) {
        return content.map((item: any) => {
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
export function createThreadRequestDefaults(cwd?: string, runtimeSettings?: RuntimeSettings | null, { includePersistExtendedHistory = true }: {
    includePersistExtendedHistory?: boolean;
} = {}) {
    const settings = sanitizeRuntimeSettings(runtimeSettings);
    const config = readThreadScopedRuntimeConfig(runtimeSettings);
    return Object.fromEntries(Object.entries({
        cwd,
        model: settings.model,
        approvalPolicy: settings.approvalPolicy,
        sandbox: settings.sandboxMode,
        config,
        persistExtendedHistory: includePersistExtendedHistory ? false : undefined,
    }).filter(([, value]: any) => value !== undefined));
}
export function createTurnRequestDefaults(cwd?: string, runtimeSettings?: RuntimeSettings | null) {
    const settings = sanitizeRuntimeSettings(runtimeSettings);
    return Object.fromEntries(Object.entries({
        cwd,
        model: settings.model,
        effort: settings.reasoningEffort,
        summary: settings.reasoningSummary,
        approvalPolicy: settings.approvalPolicy,
        sandboxPolicy: settings.sandboxMode ? createSandboxPolicyFromMode(settings.sandboxMode) : undefined,
    }).filter(([, value]: any) => value !== undefined));
}
export function createInitializeParams() {
    return {
        clientInfo: codexClientInfo,
        capabilities: {
            experimentalApi: true,
        },
    };
}
export function createStartThreadParams({ cwd, dynamicToolSpecs = [], runtimeSettings, baseInstructions, }: {
    cwd?: string;
    dynamicToolSpecs?: LooseRecord[];
    runtimeSettings?: RuntimeSettings | null;
    baseInstructions?: string;
} = {}) {
    return Object.fromEntries(Object.entries({
        ...createThreadRequestDefaults(cwd, runtimeSettings),
        baseInstructions: readOptionalPossiblyEmptyString(baseInstructions),
        experimentalRawEvents: false,
        dynamicTools: Array.isArray(dynamicToolSpecs) && dynamicToolSpecs.length ? dynamicToolSpecs : undefined,
    }).filter(([, value]: any) => value !== undefined));
}
export function createResumeThreadParams({ threadId, cwd, runtimeSettings, baseInstructions, }: {
    threadId?: string;
    cwd?: string;
    runtimeSettings?: RuntimeSettings | null;
    baseInstructions?: string;
} = {}) {
    return Object.fromEntries(Object.entries({
        threadId,
        ...createThreadRequestDefaults(cwd, runtimeSettings, { includePersistExtendedHistory: false }),
        baseInstructions: readOptionalPossiblyEmptyString(baseInstructions),
    }).filter(([, value]: any) => value !== undefined));
}
export function createStartTurnParams({ threadId, text, content, cwd, runtimeSettings, runtimePreferences, collaborationMode, }: {
    threadId?: string;
    text?: string;
    content?: LooseRecord[];
    cwd?: string;
    runtimeSettings?: RuntimeSettings | null;
    runtimePreferences?: RuntimePreferences;
    collaborationMode?: CollaborationModePreset | null;
} = {}) {
    return Object.fromEntries(Object.entries({
        threadId,
        input: normalizeTurnInputContent(content, text),
        ...createTurnRequestDefaults(cwd, runtimeSettings),
        collaborationMode: createCollaborationModeSettings({ collaborationMode, runtimeSettings, runtimePreferences }),
    }).filter(([, value]: any) => value !== undefined));
}
