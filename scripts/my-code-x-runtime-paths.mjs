import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAbsoluteUserPath, resolveMyCodeXUserDir } from '@my-code-x/utils/my-code-x-user-env';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..');

function resolveDefaultRuntimeDir(userDir = process.env.MY_CODE_X_USER_DIR || '') {
  return path.join(resolveMyCodeXUserDir(userDir), 'runtime');
}

export function resolveRuntimeDir(runtimeDir = process.env.MY_CODE_X_RUNTIME_DIR || '') {
  const trimmed = String(runtimeDir || '').trim();
  const userDir = resolveMyCodeXUserDir(process.env.MY_CODE_X_USER_DIR || '');
  const defaultRuntimeDir = resolveDefaultRuntimeDir(process.env.MY_CODE_X_USER_DIR || '');

  if (!trimmed) {
    return defaultRuntimeDir;
  }

  return isAbsoluteUserPath(trimmed) ? trimmed : path.resolve(userDir, trimmed);
}

export function buildRuntimePaths(runtimeDir = resolveRuntimeDir()) {
  const useLegacyRepoPaths = path.resolve(runtimeDir) === repoRoot;

  if (useLegacyRepoPaths) {
    return {
      runtimeDir,
      buildStamps: {
        contracts: path.join(repoRoot, '.tmp_my_code_x_contracts_build.stamp'),
        utils: path.join(repoRoot, '.tmp_my_code_x_utils_build.stamp'),
        frontend: path.join(repoRoot, '.tmp_my_code_x_frontend_build.stamp'),
        backend: path.join(repoRoot, '.tmp_my_code_x_backend_build.stamp'),
      },
      startLock: path.join(repoRoot, '.tmp_my_code_x_start.lock'),
      supervisorPid: path.join(repoRoot, '.tmp_my_code_x_supervisor.pid'),
      supervisorOutLog: path.join(repoRoot, '.tmp_my_code_x_supervisor.out.log'),
      supervisorErrLog: path.join(repoRoot, '.tmp_my_code_x_supervisor.err.log'),
      backendPid: path.join(repoRoot, '.tmp_my_code_x.pid'),
      backendOutLog: path.join(repoRoot, '.tmp_my_code_x.out.log'),
      backendErrLog: path.join(repoRoot, '.tmp_my_code_x.err.log'),
      providerPid: path.join(repoRoot, '.tmp_my_code_x_provider.pid'),
      providerOutLog: path.join(repoRoot, '.tmp_my_code_x_provider.out.log'),
      providerErrLog: path.join(repoRoot, '.tmp_my_code_x_provider.err.log'),
      stateFile: path.join(repoRoot, '.tmp_my_code_x_state.json'),
    };
  }

  return {
    runtimeDir,
    buildStamps: {
      contracts: path.join(runtimeDir, 'contracts-build.stamp'),
      utils: path.join(runtimeDir, 'utils-build.stamp'),
      frontend: path.join(runtimeDir, 'frontend-build.stamp'),
      backend: path.join(runtimeDir, 'backend-build.stamp'),
    },
    startLock: path.join(runtimeDir, 'my-code-x-start.lock'),
    supervisorPid: path.join(runtimeDir, 'my-code-x-supervisor.pid'),
    supervisorOutLog: path.join(runtimeDir, 'my-code-x-supervisor.out.log'),
    supervisorErrLog: path.join(runtimeDir, 'my-code-x-supervisor.err.log'),
    backendPid: path.join(runtimeDir, 'my-code-x-backend.pid'),
    backendOutLog: path.join(runtimeDir, 'my-code-x-backend.out.log'),
    backendErrLog: path.join(runtimeDir, 'my-code-x-backend.err.log'),
    providerPid: path.join(runtimeDir, 'my-code-x-provider.pid'),
    providerOutLog: path.join(runtimeDir, 'my-code-x-provider.out.log'),
    providerErrLog: path.join(runtimeDir, 'my-code-x-provider.err.log'),
    stateFile: path.join(runtimeDir, 'my-code-x-state.json'),
  };
}
