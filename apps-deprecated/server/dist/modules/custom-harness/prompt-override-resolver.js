import { clonePromptOverrideSnapshot, loadPromptOverrideSnapshot } from './prompt-override-loader.js';
function normalizePromptOverrideValue(promptOverride) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : '';
}
export function createPromptOverrideResolver({ workspaceRoot, customHarnessRoot, promptOverrideSnapshot = null, } = {}) {
    let snapshot = promptOverrideSnapshot ? clonePromptOverrideSnapshot(promptOverrideSnapshot) : null;
    async function ensureSnapshot() {
        if (snapshot) {
            return snapshot;
        }
        snapshot = await loadPromptOverrideSnapshot({ workspaceRoot, customHarnessRoot });
        return snapshot;
    }
    return {
        async discoverPromptOverrideOptions() {
            const loadedSnapshot = await ensureSnapshot();
            return loadedSnapshot.options.map((option) => ({ ...option }));
        },
        async resolvePromptOverride(promptOverride) {
            const normalizedPromptOverride = normalizePromptOverrideValue(promptOverride);
            if (!normalizedPromptOverride) {
                throw new Error(`prompt override not found: ${promptOverride}`);
            }
            const loadedSnapshot = await ensureSnapshot();
            if (!loadedSnapshot.instructionsByPromptOverride.has(normalizedPromptOverride)) {
                throw new Error(`prompt override not found: ${normalizedPromptOverride}`);
            }
            return loadedSnapshot.instructionsByPromptOverride.get(normalizedPromptOverride) ?? '';
        },
    };
}
//# sourceMappingURL=prompt-override-resolver.js.map