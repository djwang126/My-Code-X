import type { CodexGatewayLike, IdleShutdownConfig, LooseRecord, RuntimeOptions, RuntimePreferences, TimerHandle, } from './codex-types.js';
type GatewayRequestMethodName =
    | 'startThread'
    | 'resumeThread'
    | 'listThreads'
    | 'setThreadName'
    | 'startTurn'
    | 'interruptTurn'
    | 'compactThread'
    | 'forkThread'
    | 'rollbackThread'
    | 'startReview'
    | 'respondToRequest';
function clonePreferences(preferences: any) {
    if (!preferences || typeof preferences !== 'object') {
        return {} as RuntimePreferences;
    }
    return { ...preferences };
}
function cloneOptions(options: any) {
    if (!options || typeof options !== 'object') {
        return {} as RuntimeOptions;
    }
    return {
        models: Array.isArray(options.models) ? options.models.map((option: any) => ({ ...option })) : [],
        reasoningSummaryOptions: Array.isArray(options.reasoningSummaryOptions)
            ? options.reasoningSummaryOptions.map((option: any) => ({ ...option }))
            : [],
        approvalPolicies: Array.isArray(options.approvalPolicies) ? options.approvalPolicies.map((option: any) => ({ ...option })) : [],
        sandboxModes: Array.isArray(options.sandboxModes) ? options.sandboxModes.map((option: any) => ({ ...option })) : [],
        collaborationModes: Array.isArray(options.collaborationModes)
            ? options.collaborationModes.map((option: any) => ({ ...option }))
            : [],
        promptOverrides: Array.isArray(options.promptOverrides) ? options.promptOverrides.map((option: any) => ({ ...option })) : [],
    };
}
function readOptionValue(option: any) {
    return typeof option?.value === 'string' && option.value ? option.value : null;
}
function mergeWithCachedModelOptions(previousOptions: RuntimeOptions, nextOptions: RuntimeOptions) {
    const previousModels = Array.isArray(previousOptions.models) ? previousOptions.models : [];
    const nextModels = Array.isArray(nextOptions.models) ? nextOptions.models : [];
    if (!previousModels.length) {
        return nextOptions;
    }
    if (!nextModels.length) {
        return {
            ...nextOptions,
            models: previousModels.map((option: any) => ({ ...option })),
        };
    }
    const nextModelValues = new Set(nextModels.map(readOptionValue).filter(Boolean));
    const preservedModels = previousModels.filter((option: any) => {
        const value = readOptionValue(option);
        return value !== null && !nextModelValues.has(value);
    });
    if (!preservedModels.length) {
        return nextOptions;
    }
    return {
        ...nextOptions,
        models: [
            ...nextModels,
            ...preservedModels.map((option: any) => ({ ...option })),
        ],
    };
}
function createNoopIdleConfig() {
    return {
        kind: 'disabled',
    } satisfies IdleShutdownConfig;
}
function isIdleShutdownEnabled(idleShutdownConfig: IdleShutdownConfig) {
    return idleShutdownConfig?.kind === 'enabled' && Number.isFinite(idleShutdownConfig.idleTimeoutMs);
}
export function createCodexGatewayManager({ createGateway = async () => ({ close: async () => undefined, setNotificationHandler() { }, }), idleShutdownConfig = createNoopIdleConfig(), bootstrapPreferences = {}, bootstrapOptions = {}, isSafeToShutdown = () => true, now = () => Date.now(), setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout, }: {
    createGateway?: () => Promise<CodexGatewayLike>;
    idleShutdownConfig?: IdleShutdownConfig;
    bootstrapPreferences?: RuntimePreferences;
    bootstrapOptions?: RuntimeOptions;
    isSafeToShutdown?: () => boolean;
    now?: () => number;
    setTimeoutImpl?: (handler: () => void, delay: number) => TimerHandle;
    clearTimeoutImpl?: (timerId: TimerHandle) => void;
} = {}) {
    let currentGateway: CodexGatewayLike | null = null;
    let createGatewayPromise: Promise<CodexGatewayLike> | null = null;
    let idleTimerId: TimerHandle | null = null;
    let lastActivityAt: number | null = null;
    let inFlightRequestCount = 0;
    let notificationHandler = (_event: LooseRecord) => { };
    let cachedPreferences = clonePreferences(bootstrapPreferences);
    let cachedOptions = cloneOptions(bootstrapOptions);
    let gatewayGeneration = 0;
    function syncCachedMetadata(gateway: CodexGatewayLike) {
        cachedPreferences =
            typeof gateway?.getPreferences === 'function' ? clonePreferences(gateway.getPreferences()) : clonePreferences(cachedPreferences);
        const nextOptions = typeof gateway?.getOptions === 'function' ? cloneOptions(gateway.getOptions()) : cloneOptions(cachedOptions);
        cachedOptions = mergeWithCachedModelOptions(cachedOptions, nextOptions);
    }
    function clearIdleTimer() {
        if (idleTimerId === null) {
            return;
        }
        clearTimeoutImpl(idleTimerId);
        idleTimerId = null;
    }
    async function closeActiveGateway() {
        clearIdleTimer();
        if (!currentGateway) {
            return;
        }
        const gatewayToClose = currentGateway;
        currentGateway = null;
        await gatewayToClose.close();
    }
    function canCloseGatewayNow() {
        if (inFlightRequestCount > 0) {
            return false;
        }
        return isSafeToShutdown();
    }
    function scheduleIdleShutdown() {
        clearIdleTimer();
        if (!isIdleShutdownEnabled(idleShutdownConfig) || !currentGateway) {
            return;
        }
        const idleTimeoutMs = idleShutdownConfig.idleTimeoutMs ?? 0;
        idleTimerId = setTimeoutImpl(() => {
            idleTimerId = null;
            if (!currentGateway) {
                return;
            }
            if (!canCloseGatewayNow()) {
                lastActivityAt = now();
                scheduleIdleShutdown();
                return;
            }
            void closeActiveGateway();
        }, idleTimeoutMs);
    }
    function markActivity() {
        lastActivityAt = now();
        scheduleIdleShutdown();
    }
    function attachNotificationHandler(gateway: CodexGatewayLike) {
        gateway.setNotificationHandler((event: any) => {
            markActivity();
            notificationHandler(event);
        });
    }
    async function ensureGateway() {
        if (currentGateway) {
            return currentGateway;
        }
        if (createGatewayPromise) {
            return createGatewayPromise;
        }
        createGatewayPromise = (async () => {
            const gateway = await createGateway();
            currentGateway = gateway;
            gatewayGeneration += 1;
            attachNotificationHandler(gateway);
            syncCachedMetadata(gateway);
            markActivity();
            return gateway;
        })();
        try {
            return await createGatewayPromise;
        }
        finally {
            createGatewayPromise = null;
        }
    }
    async function runGatewayMethod(methodName: GatewayRequestMethodName, input?: LooseRecord): Promise<unknown> {
        inFlightRequestCount += 1;
        markActivity();
        try {
            const gateway = await ensureGateway();
            const gatewayMethod = gateway[methodName] as ((input?: LooseRecord) => Promise<unknown>) | undefined;
            if (typeof gatewayMethod !== 'function') {
                throw new Error(`gateway method is not available: ${String(methodName)}`);
            }
            const result = await gatewayMethod.call(gateway, input);
            markActivity();
            return result;
        }
        finally {
            inFlightRequestCount -= 1;
        }
    }
    return {
        async initialize() {
            await ensureGateway();
        },
        setNotificationHandler(nextHandler: any) {
            notificationHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
            if (currentGateway) {
                attachNotificationHandler(currentGateway);
            }
        },
        async startThread(input: any) {
            return runGatewayMethod('startThread', input);
        },
        async resumeThread(input: any) {
            return runGatewayMethod('resumeThread', input);
        },
        async listThreads(input: any) {
            return runGatewayMethod('listThreads', input);
        },
        async setThreadName(input: any) {
            return runGatewayMethod('setThreadName', input);
        },
        async startTurn(input: any) {
            return runGatewayMethod('startTurn', input);
        },
        async interruptTurn(input: any) {
            return runGatewayMethod('interruptTurn', input);
        },
        async compactThread(input: any) {
            return runGatewayMethod('compactThread', input);
        },
        async forkThread(input: any) {
            return runGatewayMethod('forkThread', input);
        },
        async rollbackThread(input: any) {
            return runGatewayMethod('rollbackThread', input);
        },
        async startReview(input: any) {
            return runGatewayMethod('startReview', input);
        },
        async respondToRequest(input: any) {
            return runGatewayMethod('respondToRequest', input);
        },
        getPreferences() {
            return clonePreferences(cachedPreferences);
        },
        getOptions() {
            return cloneOptions(cachedOptions);
        },
        hasActiveGateway() {
            return currentGateway !== null;
        },
        getGatewayGeneration() {
            return gatewayGeneration;
        },
        async close() {
            clearIdleTimer();
            if (createGatewayPromise) {
                await createGatewayPromise;
            }
            await closeActiveGateway();
        },
        getLastActivityAt() {
            return lastActivityAt;
        },
    } as CodexGatewayLike & {
        initialize(): Promise<void>;
        hasActiveGateway(): boolean;
        getGatewayGeneration(): number;
        getLastActivityAt(): number | null;
    };
}
