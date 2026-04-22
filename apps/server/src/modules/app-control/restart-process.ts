import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
type ProcessEnv = typeof process.env;
function resolveRestartInvocation(restartScript: any) {
    const extension = path.extname(restartScript).toLowerCase();
    if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
        return {
            command: process.execPath,
            args: [restartScript],
        };
    }
    if (extension === '.ts') {
        return {
            command: process.execPath,
            args: ['--import', tsxLoaderPath, restartScript],
        };
    }
    if (process.platform === 'win32' && (extension === '.bat' || extension === '.cmd')) {
        return {
            command: 'cmd.exe',
            args: ['/c', restartScript],
        };
    }
    if (process.platform !== 'win32' && extension === '.sh') {
        return {
            command: '/bin/sh',
            args: [restartScript],
        };
    }
    return {
        command: restartScript,
        args: [],
    };
}
export function spawnRestartProcess(restartScript: string, options: {
    cwd?: string;
    env?: ProcessEnv;
} = {}) {
    const { cwd, env } = options;
    const invocation = resolveRestartInvocation(restartScript);
    const child = spawn(invocation.command, invocation.args, {
        cwd,
        detached: true,
        stdio: 'ignore',
        env,
    });
    child.unref();
    return child;
}
