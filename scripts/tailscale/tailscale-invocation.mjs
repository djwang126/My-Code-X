import process from 'node:process';

export function buildTailscaleInvocation(args, { repoRoot, env = process.env } = {}) {
  const overrideCommand = String(env.MY_CODE_X_TAILSCALE_COMMAND || '').trim();
  const overrideArgsJson = String(env.MY_CODE_X_TAILSCALE_ARGS_JSON || '').trim();
  const overrideCwd = String(env.MY_CODE_X_TAILSCALE_CWD || '').trim();

  if (overrideCommand) {
    let prefixArgs = [];
    if (overrideArgsJson) {
      const parsed = JSON.parse(overrideArgsJson);
      if (!Array.isArray(parsed)) {
        throw new Error('MY_CODE_X_TAILSCALE_ARGS_JSON must be a JSON array');
      }
      prefixArgs = parsed.map(value => String(value));
    }

    return {
      command: overrideCommand,
      args: [...prefixArgs, ...args],
      cwd: overrideCwd || repoRoot,
    };
  }

  return {
    command: 'tailscale',
    args,
    cwd: repoRoot,
  };
}

export function createRunTailscaleCommand({ repoRoot, runCommand, env = process.env }) {
  return async function runTailscaleCommand(args, options = {}) {
    const commandEnv = options.env ?? env;
    const invocation = buildTailscaleInvocation(args, { repoRoot, env: commandEnv });
    return await runCommand(invocation.command, invocation.args, {
      ...options,
      cwd: invocation.cwd,
      env: commandEnv,
    });
  };
}
