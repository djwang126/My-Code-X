import fs from 'node:fs/promises';
import path from 'node:path';
import { isAbsoluteUserPath } from '@my-code-x/utils/my-code-x-user-env';
const PROMPTS_OVERRIDE_SEGMENTS = ['custom-harness', 'prompts-override'];
export function resolveCustomHarnessRoot({ workspaceRoot, customHarnessRoot } = {}) {
    const normalizedCustomHarnessRoot = String(customHarnessRoot || '').trim();
    if (normalizedCustomHarnessRoot) {
        return isAbsoluteUserPath(normalizedCustomHarnessRoot)
            ? normalizedCustomHarnessRoot
            : path.resolve(normalizedCustomHarnessRoot);
    }
    return path.resolve(String(workspaceRoot || ''), PROMPTS_OVERRIDE_SEGMENTS[0]);
}
function resolvePromptsOverrideDir({ workspaceRoot, customHarnessRoot } = {}) {
    return path.join(resolveCustomHarnessRoot({ workspaceRoot, customHarnessRoot }), 'prompts-override');
}
function createPromptOverrideOption(value) {
    return {
        value,
        label: value,
        description: '',
    };
}
export function clonePromptOverrideSnapshot({ options = [], instructionsByPromptOverride = new Map(), } = {}) {
    return {
        options: options.map((option) => ({ ...option })),
        instructionsByPromptOverride: new Map(instructionsByPromptOverride),
    };
}
async function readPromptOverrideFile(filePath, promptOverride) {
    const stats = await fs.stat(filePath).catch(error => {
        if (error?.code === 'ENOENT') {
            throw new Error(`prompt override not found: ${promptOverride}`);
        }
        throw error;
    });
    if (!stats.isFile()) {
        throw new Error(`prompt override is invalid: ${promptOverride}`);
    }
    return fs.readFile(filePath, 'utf8');
}
function normalizePromptOverrideValue(promptOverride) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : '';
}
async function listPromptOverrideOptions({ workspaceRoot, customHarnessRoot, } = {}) {
    const promptsOverrideDir = resolvePromptsOverrideDir({ workspaceRoot, customHarnessRoot });
    const directoryEntries = await fs.readdir(promptsOverrideDir, { withFileTypes: true }).catch(error => {
        if (error?.code === 'ENOENT') {
            return [];
        }
        throw error;
    });
    const options = [];
    for (const entry of directoryEntries) {
        if (!entry.isFile()) {
            continue;
        }
        if (!entry.name.endsWith('.md') || entry.name.startsWith('.')) {
            continue;
        }
        const promptOverride = entry.name.slice(0, -3);
        if (!promptOverride) {
            continue;
        }
        options.push(createPromptOverrideOption(promptOverride));
    }
    return options.sort((left, right) => left.value.localeCompare(right.value));
}
async function readPromptOverrideInstructions({ workspaceRoot, customHarnessRoot, promptOverride, } = {}) {
    const normalizedPromptOverride = normalizePromptOverrideValue(promptOverride ?? '');
    if (!normalizedPromptOverride) {
        throw new Error(`prompt override not found: ${promptOverride}`);
    }
    const promptsOverrideDir = resolvePromptsOverrideDir({ workspaceRoot, customHarnessRoot });
    const filePath = path.resolve(promptsOverrideDir, `${normalizedPromptOverride}.md`);
    const relativePath = path.relative(promptsOverrideDir, filePath);
    if (!relativePath ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath) ||
        relativePath.split(path.sep).length !== 1) {
        throw new Error(`prompt override not found: ${normalizedPromptOverride}`);
    }
    return readPromptOverrideFile(filePath, normalizedPromptOverride);
}
export async function loadPromptOverrideSnapshot({ workspaceRoot, customHarnessRoot, } = {}) {
    const options = await listPromptOverrideOptions({ workspaceRoot, customHarnessRoot });
    const instructionsByPromptOverride = new Map();
    for (const option of options) {
        const instructions = await readPromptOverrideInstructions({
            workspaceRoot,
            customHarnessRoot,
            promptOverride: option.value,
        });
        instructionsByPromptOverride.set(option.value, instructions);
    }
    return clonePromptOverrideSnapshot({ options, instructionsByPromptOverride });
}
//# sourceMappingURL=prompt-override-loader.js.map