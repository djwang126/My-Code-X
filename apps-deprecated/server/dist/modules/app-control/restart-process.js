import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const tsxLoaderPath = pathToFileURL(require.resolve('tsx')).href;
function resolveRestartInvocation(restartScript) {
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
export function spawnRestartProcess(restartScript, options = {}) {
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
//# sourceMappingURL=restart-process.js.map