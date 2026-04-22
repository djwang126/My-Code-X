import { createDefaultRuntimePreferences } from './preferences.js';
import { hasOwnKey, humanizeKebabLabel, sanitizeRuntimeSettings } from './shared.js';
import type { CollaborationModePreset, LooseRecord, RuntimePreferences, RuntimeSettings } from '../codex-types.js';
function mapCodexCollaborationModeKind(value: any) {
    return typeof value === 'string' && value ? value : null;
}
export function mapCodexCollaborationModePresets(collaborationModeListResponse: LooseRecord | null | undefined) {
    const presets = Array.isArray(collaborationModeListResponse?.data) ? collaborationModeListResponse.data : [];
    return presets.flatMap((preset: any): CollaborationModePreset[] => {
        const kind = mapCodexCollaborationModeKind(preset?.mode);
        if (!kind) {
            return [];
        }
        const normalizedPreset: CollaborationModePreset = {
            kind,
            label: typeof preset?.name === 'string' && preset.name ? preset.name : humanizeKebabLabel(kind),
            model: typeof preset?.model === 'string' && preset.model ? preset.model : null,
        };
        if (hasOwnKey(preset, 'reasoning_effort')) {
            normalizedPreset.reasoningEffort = preset.reasoning_effort ?? null;
        }
        return [normalizedPreset];
    });
}
export function createCollaborationModeSettings({ collaborationMode, runtimeSettings, runtimePreferences = createDefaultRuntimePreferences(), }: {
    collaborationMode?: CollaborationModePreset | null;
    runtimeSettings?: RuntimeSettings | null;
    runtimePreferences?: RuntimePreferences;
} = {}) {
    if (!collaborationMode?.kind) {
        return undefined;
    }
    const settings = sanitizeRuntimeSettings(runtimeSettings);
    const model = collaborationMode.model ?? settings.model ?? runtimePreferences.model ?? createDefaultRuntimePreferences().model;
    let reasoningEffort;
    if (Object.prototype.hasOwnProperty.call(collaborationMode, 'reasoningEffort')) {
        reasoningEffort = collaborationMode.reasoningEffort ?? null;
    }
    else if (Object.prototype.hasOwnProperty.call(settings, 'reasoningEffort')) {
        reasoningEffort = settings.reasoningEffort ?? null;
    }
    else {
        reasoningEffort = runtimePreferences.reasoningEffort ?? null;
    }
    return {
        mode: collaborationMode.kind,
        settings: {
            model,
            reasoning_effort: reasoningEffort,
            developer_instructions: null,
        },
    };
}
