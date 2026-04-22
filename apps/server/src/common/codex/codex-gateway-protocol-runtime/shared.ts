import type { LooseRecord, RuntimeOption, RuntimeSettings } from '../codex-types.js';
export function hasOwnKey(value: unknown, key: string) {
    return Boolean(value) && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}
export function readRuntimeNumber(value: unknown) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    return undefined;
}
export function readOptionalString(value: unknown) {
    return typeof value === 'string' && value ? value : undefined;
}
export function readOptionalPossiblyEmptyString(value: unknown) {
    return typeof value === 'string' ? value : undefined;
}
export function humanizeKebabLabel(value: unknown) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part: any) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
export function normalizeRuntimeOption(value: unknown): RuntimeOption | null {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const option = value as LooseRecord;
    const optionValue = readOptionalString(option.value);
    if (!optionValue) {
        return null;
    }
    return {
        value: optionValue,
        label: readOptionalString(option.label) ?? optionValue,
        description: readOptionalString(option.description) ?? '',
    };
}
export function sanitizeRuntimeSettings(runtimeSettings: RuntimeSettings | null | undefined): RuntimeSettings {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return {};
    }
    const settings = runtimeSettings as RuntimeSettings;
    return Object.fromEntries(Object.entries({
        model: typeof settings.model === 'string' && settings.model ? settings.model : undefined,
        reasoningEffort: typeof settings.reasoningEffort === 'string' && settings.reasoningEffort ? settings.reasoningEffort : undefined,
        reasoningSummary: typeof settings.reasoningSummary === 'string' && settings.reasoningSummary
            ? settings.reasoningSummary
            : undefined,
        approvalPolicy: typeof settings.approvalPolicy === 'string' && settings.approvalPolicy ? settings.approvalPolicy : undefined,
        sandboxMode: typeof settings.sandboxMode === 'string' && settings.sandboxMode ? settings.sandboxMode : undefined,
    }).filter(([, value]: any) => value !== undefined));
}
export function readThreadScopedRuntimeConfig(runtimeSettings: RuntimeSettings | null | undefined): LooseRecord | undefined {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return undefined;
    }
    const settings = runtimeSettings as RuntimeSettings;
    const config: LooseRecord = {};
    if (hasOwnKey(settings, 'modelContextWindow')) {
        const parsed = readRuntimeNumber(settings.modelContextWindow);
        if (parsed !== undefined) {
            config.model_context_window = parsed;
        }
    }
    if (hasOwnKey(settings, 'modelAutoCompactTokenLimit')) {
        const parsed = readRuntimeNumber(settings.modelAutoCompactTokenLimit);
        if (parsed !== undefined) {
            config.model_auto_compact_token_limit = parsed;
        }
    }
    return Object.keys(config).length ? config : undefined;
}
