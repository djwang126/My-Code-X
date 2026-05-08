import { mapCodexCollaborationModePresets } from './collaboration-mode.js';
import { createDefaultRuntimePreferences } from './preferences.js';
import { humanizeKebabLabel, normalizeRuntimeOption } from './shared.js';
import type { LooseRecord, RuntimeOption, RuntimeOptions, RuntimePreferences } from '../codex-types.js';
function createReasoningSummaryOptions() {
    return [
        {
            value: 'auto',
            label: 'Auto',
            description: 'Use the model default reasoning summary behavior.',
        },
        {
            value: 'concise',
            label: 'Concise',
            description: 'Show a short reasoning summary.',
        },
        {
            value: 'detailed',
            label: 'Detailed',
            description: 'Show a more detailed reasoning summary.',
        },
        {
            value: 'none',
            label: 'None',
            description: 'Do not request a reasoning summary.',
        },
    ];
}
function getApprovalPolicyLabel(value: any) {
    switch (value) {
        case 'never':
            return 'Never';
        case 'unless-trusted':
            return 'Unless trusted';
        case 'on-failure':
            return 'On failure';
        case 'on-request':
            return 'On request';
        default:
            return humanizeKebabLabel(value);
    }
}
function getSandboxModeLabel(value: any) {
    switch (value) {
        case 'read-only':
            return 'Read only';
        case 'workspace-write':
            return 'Workspace write';
        case 'danger-full-access':
            return 'Danger full access';
        default:
            return humanizeKebabLabel(value);
    }
}
export function createDefaultRuntimeOptions(fallbackPreferences: RuntimePreferences = createDefaultRuntimePreferences()): RuntimeOptions {
    return {
        models: [
            {
                value: fallbackPreferences.model ?? '',
                label: fallbackPreferences.model ?? '',
                description: 'Current Codex default',
                reasoningEfforts: fallbackPreferences.reasoningEffort
                    ? [
                        {
                            value: fallbackPreferences.reasoningEffort,
                            label: humanizeKebabLabel(fallbackPreferences.reasoningEffort),
                            description: '',
                        },
                    ]
                    : [],
                defaultReasoningEffort: fallbackPreferences.reasoningEffort ?? null,
            },
        ],
        reasoningSummaryOptions: createReasoningSummaryOptions(),
        approvalPolicies: ['never', 'unless-trusted', 'on-failure', 'on-request'].map((value: any) => ({
            value,
            label: getApprovalPolicyLabel(value),
            description: '',
        })),
        sandboxModes: ['read-only', 'workspace-write', 'danger-full-access'].map((value: any) => ({
            value,
            label: getSandboxModeLabel(value),
            description: '',
        })),
        promptOverrides: [],
    };
}
export function mapCodexRuntimeOptions({ modelListResponse, configRequirementsResponse, fallbackPreferences = null, collaborationModeListResponse, promptOverrideOptions, }: {
    modelListResponse?: LooseRecord | null;
    configRequirementsResponse?: LooseRecord | null;
    fallbackPreferences?: RuntimePreferences | null;
    collaborationModeListResponse?: LooseRecord | null;
    promptOverrideOptions?: RuntimeOption[] | null;
} = {}) {
    const modelItems = Array.isArray(modelListResponse?.data) ? modelListResponse.data : [];
    const requirements = configRequirementsResponse?.requirements ?? configRequirementsResponse ?? {};
    const allowedApprovalPolicies = Array.isArray(requirements.allowedApprovalPolicies)
        ? requirements.allowedApprovalPolicies
        : null;
    const allowedSandboxModes = Array.isArray(requirements.allowedSandboxModes) ? requirements.allowedSandboxModes : null;
    const fallbackOptions = fallbackPreferences ? createDefaultRuntimeOptions(fallbackPreferences) : null;
    const collaborationModePresets = mapCodexCollaborationModePresets(collaborationModeListResponse);
    const promptOverrideOptionsProvided = Array.isArray(promptOverrideOptions);
    const normalizedPromptOverrideOptions = Array.isArray(promptOverrideOptions)
        ? promptOverrideOptions.map(normalizeRuntimeOption).filter(Boolean)
        : [];
    if (!modelItems.length &&
        !allowedApprovalPolicies &&
        !allowedSandboxModes &&
        !fallbackOptions &&
        !collaborationModePresets.length &&
        !normalizedPromptOverrideOptions.length &&
        !promptOverrideOptionsProvided) {
        return null;
    }
    return {
        models: modelItems.length
            ? modelItems.map((model: any) => ({
                value: model.model,
                label: model.displayName || model.model,
                description: model.description || '',
                reasoningEfforts: Array.isArray(model.supportedReasoningEfforts)
                    ? model.supportedReasoningEfforts.map((option: any) => ({
                        value: option.reasoningEffort,
                        label: humanizeKebabLabel(option.reasoningEffort),
                        description: option.description || '',
                    }))
                    : [],
                defaultReasoningEffort: model.defaultReasoningEffort ?? null,
            }))
            : (fallbackOptions?.models ?? []),
        reasoningSummaryOptions: createReasoningSummaryOptions(),
        approvalPolicies: (allowedApprovalPolicies ?? (fallbackOptions?.approvalPolicies ?? []).map((option: any) => option.value) ?? []).map((value: any) => ({
            value,
            label: getApprovalPolicyLabel(value),
            description: '',
        })),
        sandboxModes: (allowedSandboxModes ?? (fallbackOptions?.sandboxModes ?? []).map((option: any) => option.value) ?? []).map((value: any) => ({
            value,
            label: getSandboxModeLabel(value),
            description: '',
        })),
        collaborationModes: collaborationModePresets.map((preset: any) => ({
            kind: preset.kind,
            label: preset.label,
            model: preset.model,
            reasoningEffort: Object.prototype.hasOwnProperty.call(preset, 'reasoningEffort') ? preset.reasoningEffort : null,
        })),
        promptOverrides: normalizedPromptOverrideOptions,
    };
}
