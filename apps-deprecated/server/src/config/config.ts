import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMyCodeXCustomHarnessDir } from '@my-code-x/utils/my-code-x-user-harness';
import { resolveMyCodeXUserDir } from '@my-code-x/utils/my-code-x-user-env';
import { readCodexIdleShutdownConfig } from './codex-idle-shutdown-config.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
export const frontendDistDir = path.join(repoRoot, 'apps', 'web', 'dist');
export const host = process.env.HOST || '127.0.0.1';
export const port = Number.parseInt(process.env.PORT || '4310', 10);
export const authToken = String(process.env.MY_CODE_X_AUTH_TOKEN || '').trim();
export const serverInstanceId = process.env.SERVER_INSTANCE_ID || `next-${process.pid}`;
export const codexBin = String(process.env.CODEX_BIN || 'codex').trim() || 'codex';
export const restartScript = String(process.env.WEB_CODEX_RESTART_SCRIPT || '').trim();
export const codexIdleShutdownConfig = readCodexIdleShutdownConfig({ env: process.env });
export const myCodeXUserDir = resolveMyCodeXUserDir(process.env.MY_CODE_X_USER_DIR || '');
export const myCodeXCustomHarnessDir = resolveMyCodeXCustomHarnessDir({
    userDir: process.env.MY_CODE_X_USER_DIR || '',
});
export const codexWorkingDir = process.env.CODEX_WORKING_DIR || myCodeXUserDir;
function parseCodexDynamicTools(value: any) {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        return [];
    }
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
        throw new Error('MY_CODE_X_DYNAMIC_TOOLS_JSON must be a JSON array');
    }
    return parsed;
}
export const codexDynamicTools = parseCodexDynamicTools(process.env.MY_CODE_X_DYNAMIC_TOOLS_JSON || '');
