export function hasOwnKey(value, key) {
    return Boolean(value) && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
}
export function readRuntimeNumber(value) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    return undefined;
}
export function readOptionalString(value) {
    return typeof value === 'string' && value ? value : undefined;
}
export function readOptionalPossiblyEmptyString(value) {
    return typeof value === 'string' ? value : undefined;
}
export function humanizeKebabLabel(value) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
export function normalizeRuntimeOption(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const option = value;
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
export function sanitizeRuntimeSettings(runtimeSettings) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return {};
    }
    const settings = runtimeSettings;
    return Object.fromEntries(Object.entries({
        model: typeof settings.model === 'string' && settings.model ? settings.model : undefined,
        reasoningEffort: typeof settings.reasoningEffort === 'string' && settings.reasoningEffort ? settings.reasoningEffort : undefined,
        reasoningSummary: typeof settings.reasoningSummary === 'string' && settings.reasoningSummary
            ? settings.reasoningSummary
            : undefined,
        approvalPolicy: typeof settings.approvalPolicy === 'string' && settings.approvalPolicy ? settings.approvalPolicy : undefined,
        sandboxMode: typeof settings.sandboxMode === 'string' && settings.sandboxMode ? settings.sandboxMode : undefined,
    }).filter(([, value]) => value !== undefined));
}
export function readThreadScopedRuntimeConfig(runtimeSettings) {
    if (!runtimeSettings || typeof runtimeSettings !== 'object') {
        return undefined;
    }
    const settings = runtimeSettings;
    const config = {};
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
//# sourceMappingURL=shared.js.map