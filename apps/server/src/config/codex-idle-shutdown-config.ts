const DEFAULT_IDLE_TIMEOUT_MINUTES = 10;
const ENV_KEY = 'MY_CODE_X_CODEX_IDLE_SHUTDOWN_MINUTES';
function readConfiguredMinutes(env: any) {
    const rawValue = String(env?.[ENV_KEY] || '').trim();
    if (!rawValue) {
        return DEFAULT_IDLE_TIMEOUT_MINUTES;
    }
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        throw new Error(`${ENV_KEY} must be a number of minutes`);
    }
    return parsedValue;
}
export function readCodexIdleShutdownConfig({ env = process.env }: any = {}) {
    const idleTimeoutMinutes = readConfiguredMinutes(env);
    if (idleTimeoutMinutes <= 0) {
        return {
            kind: 'disabled',
        };
    }
    return {
        kind: 'enabled',
        idleTimeoutMinutes,
        idleTimeoutMs: Math.round(idleTimeoutMinutes * 60000),
    };
}
