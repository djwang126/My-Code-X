import { clonePromptOverrideSnapshot, loadPromptOverrideSnapshot } from './prompt-override-loader.js';
import type { PromptOverrideResolver, PromptOverrideSnapshot } from '../../common/codex/codex-types.js';
function normalizePromptOverrideValue(promptOverride: string) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : '';
}
type CreatePromptOverrideResolverInput = {
    workspaceRoot?: string;
    customHarnessRoot?: string;
    promptOverrideSnapshot?: PromptOverrideSnapshot | null;
};
export function createPromptOverrideResolver({ workspaceRoot, customHarnessRoot, promptOverrideSnapshot = null, }: CreatePromptOverrideResolverInput = {}): PromptOverrideResolver {
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
            return loadedSnapshot.options.map((option: any) => ({ ...option }));
        },
        async resolvePromptOverride(promptOverride: any) {
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
