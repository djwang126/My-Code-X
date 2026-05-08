function clonePreferences(preferences) {
    if (!preferences || typeof preferences !== 'object') {
        return {};
    }
    return { ...preferences };
}
function cloneOptions(options) {
    if (!options || typeof options !== 'object') {
        return {};
    }
    return {
        models: Array.isArray(options.models) ? options.models.map((option) => ({ ...option })) : [],
        reasoningSummaryOptions: Array.isArray(options.reasoningSummaryOptions)
            ? options.reasoningSummaryOptions.map((option) => ({ ...option }))
            : [],
        approvalPolicies: Array.isArray(options.approvalPolicies) ? options.approvalPolicies.map((option) => ({ ...option })) : [],
        sandboxModes: Array.isArray(options.sandboxModes) ? options.sandboxModes.map((option) => ({ ...option })) : [],
        collaborationModes: Array.isArray(options.collaborationModes)
            ? options.collaborationModes.map((option) => ({ ...option }))
            : [],
        promptOverrides: Array.isArray(options.promptOverrides) ? options.promptOverrides.map((option) => ({ ...option })) : [],
    };
}
function readOptionValue(option) {
    return typeof option?.value === 'string' && option.value ? option.value : null;
}
function mergeWithCachedModelOptions(previousOptions, nextOptions) {
    const previousModels = Array.isArray(previousOptions.models) ? previousOptions.models : [];
    const nextModels = Array.isArray(nextOptions.models) ? nextOptions.models : [];
    if (!previousModels.length) {
        return nextOptions;
    }
    if (!nextModels.length) {
        return {
            ...nextOptions,
            models: previousModels.map((option) => ({ ...option })),
        };
    }
    const nextModelValues = new Set(nextModels.map(readOptionValue).filter(Boolean));
    const preservedModels = previousModels.filter((option) => {
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
            ...preservedModels.map((option) => ({ ...option })),
        ],
    };
}
function createNoopIdleConfig() {
    return {
        kind: 'disabled',
    };
}
function isIdleShutdownEnabled(idleShutdownConfig) {
    return idleShutdownConfig?.kind === 'enabled' && Number.isFinite(idleShutdownConfig.idleTimeoutMs);
}
export function createCodexGatewayManager({ createGateway = async () => ({ close: async () => undefined, setNotificationHandler() { }, }), idleShutdownConfig = createNoopIdleConfig(), bootstrapPreferences = {}, bootstrapOptions = {}, isSafeToShutdown = () => true, now = () => Date.now(), setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout, } = {}) {
    let currentGateway = null;
    let createGatewayPromise = null;
    let idleTimerId = null;
    let lastActivityAt = null;
    let inFlightRequestCount = 0;
    let notificationHandler = (_event) => { };
    let cachedPreferences = clonePreferences(bootstrapPreferences);
    let cachedOptions = cloneOptions(bootstrapOptions);
    let gatewayGeneration = 0;
    function syncCachedMetadata(gateway) {
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
    function attachNotificationHandler(gateway) {
        gateway.setNotificationHandler((event) => {
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
    async function runGatewayMethod(methodName, input) {
        inFlightRequestCount += 1;
        markActivity();
        try {
            const gateway = await ensureGateway();
            const gatewayMethod = gateway[methodName];
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
        setNotificationHandler(nextHandler) {
            notificationHandler = typeof nextHandler === 'function' ? nextHandler : () => { };
            if (currentGateway) {
                attachNotificationHandler(currentGateway);
            }
        },
        async startThread(input) {
            return runGatewayMethod('startThread', input);
        },
        async resumeThread(input) {
            return runGatewayMethod('resumeThread', input);
        },
        async listThreads(input) {
            return runGatewayMethod('listThreads', input);
        },
        async setThreadName(input) {
            return runGatewayMethod('setThreadName', input);
        },
        async startTurn(input) {
            return runGatewayMethod('startTurn', input);
        },
        async interruptTurn(input) {
            return runGatewayMethod('interruptTurn', input);
        },
        async compactThread(input) {
            return runGatewayMethod('compactThread', input);
        },
        async forkThread(input) {
            return runGatewayMethod('forkThread', input);
        },
        async rollbackThread(input) {
            return runGatewayMethod('rollbackThread', input);
        },
        async startReview(input) {
            return runGatewayMethod('startReview', input);
        },
        async respondToRequest(input) {
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
    };
}
//# sourceMappingURL=codex-gateway-manager.js.map