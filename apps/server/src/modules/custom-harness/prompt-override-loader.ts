import fs from 'node:fs/promises';
import path from 'node:path';
import { isAbsoluteUserPath } from '@my-code-x/utils/my-code-x-user-env';
import type { PromptOverrideOption, PromptOverrideSnapshot } from '../../common/codex/codex-types.js';
const PROMPTS_OVERRIDE_SEGMENTS = ['custom-harness', 'prompts-override'];
type PromptOverrideLocationInput = {
    workspaceRoot?: string;
    customHarnessRoot?: string;
};
export function resolveCustomHarnessRoot({ workspaceRoot, customHarnessRoot }: PromptOverrideLocationInput = {}) {
    const normalizedCustomHarnessRoot = String(customHarnessRoot || '').trim();
    if (normalizedCustomHarnessRoot) {
        return isAbsoluteUserPath(normalizedCustomHarnessRoot)
            ? normalizedCustomHarnessRoot
            : path.resolve(normalizedCustomHarnessRoot);
    }
    return path.resolve(String(workspaceRoot || ''), PROMPTS_OVERRIDE_SEGMENTS[0]);
}
function resolvePromptsOverrideDir({ workspaceRoot, customHarnessRoot }: PromptOverrideLocationInput = {}) {
    return path.join(resolveCustomHarnessRoot({ workspaceRoot, customHarnessRoot }), 'prompts-override');
}
function createPromptOverrideOption(value: string): PromptOverrideOption {
    return {
        value,
        label: value,
        description: '',
    };
}
export function clonePromptOverrideSnapshot({ options = [], instructionsByPromptOverride = new Map(), }: Partial<PromptOverrideSnapshot> = {}): PromptOverrideSnapshot {
    return {
        options: options.map((option: any) => ({ ...option })),
        instructionsByPromptOverride: new Map(instructionsByPromptOverride),
    };
}
async function readPromptOverrideFile(filePath: string, promptOverride: string) {
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
function normalizePromptOverrideValue(promptOverride: string) {
    return typeof promptOverride === 'string' && promptOverride.trim() ? promptOverride.trim() : '';
}
async function listPromptOverrideOptions({ workspaceRoot, customHarnessRoot, }: PromptOverrideLocationInput = {}): Promise<PromptOverrideOption[]> {
    const promptsOverrideDir = resolvePromptsOverrideDir({ workspaceRoot, customHarnessRoot });
    const directoryEntries = await fs.readdir(promptsOverrideDir, { withFileTypes: true }).catch(error => {
        if (error?.code === 'ENOENT') {
            return [];
        }
        throw error;
    });
    const options: PromptOverrideOption[] = [];
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
    return options.sort((left: any, right: any) => left.value.localeCompare(right.value));
}
async function readPromptOverrideInstructions({ workspaceRoot, customHarnessRoot, promptOverride, }: PromptOverrideLocationInput & {
    promptOverride?: string;
} = {}) {
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
export async function loadPromptOverrideSnapshot({ workspaceRoot, customHarnessRoot, }: PromptOverrideLocationInput = {}): Promise<PromptOverrideSnapshot> {
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
