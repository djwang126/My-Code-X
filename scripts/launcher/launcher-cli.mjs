const launcherActions = new Set(['start', 'stop', 'status', 'restart', 'logs']);
const validExposureModes = new Set(['lan', 'tailscale', 'cloudflare']);
const DEFAULT_LAUNCHER_EXPOSE_MODE = 'tailscale';
const exposureModeSources = {
  cli: 'cli',
  env: 'env',
  default: 'default',
};

export function parseCliArgs(argv) {
  const parsed = {
    action: 'start',
    expose: '',
    all: false,
    noBuild: false,
    restart: false,
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (launcherActions.has(arg)) {
      parsed.action = arg;
      continue;
    }

    if (arg === '--no-build') {
      parsed.noBuild = true;
      continue;
    }

    if (arg === '--all') {
      parsed.all = true;
      continue;
    }

    if (arg === '--restart') {
      parsed.restart = true;
      continue;
    }

    if (arg === '--json') {
      parsed.json = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith('--expose=')) {
      parsed.expose = arg.slice('--expose='.length).trim().toLowerCase();
    }
  }

  return parsed;
}

function assertValidExposureMode(mode) {
  if (!validExposureModes.has(mode)) {
    throw new Error(`Unsupported exposure mode: ${mode}`);
  }
}

export function resolveExposureSelection(args, env = process.env) {
  if (args.expose) {
    assertValidExposureMode(args.expose);
    return {
      mode: args.expose,
      source: exposureModeSources.cli,
    };
  }

  const envMode = String(env.MY_CODE_X_EXPOSE_MODE || '').trim().toLowerCase();
  if (envMode) {
    assertValidExposureMode(envMode);
    return {
      mode: envMode,
      source: exposureModeSources.env,
    };
  }

  return {
    mode: DEFAULT_LAUNCHER_EXPOSE_MODE,
    source: exposureModeSources.default,
  };
}

export function resolveExposureMode(args, env = process.env) {
  return resolveExposureSelection(args, env).mode;
}
