import { createCanonicalUserMessageId } from '@my-code-x/contracts';
export const NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS = 'Normal prompt override instructions';
export const CAT_PROMPT_OVERRIDE_INSTRUCTIONS = 'You are a cute cat';
export function createPromptOverrideResolver() {
    return {
        async resolvePromptOverride(promptOverride: any) {
            if (promptOverride === 'normal') {
                return NORMAL_PROMPT_OVERRIDE_INSTRUCTIONS;
            }
            if (promptOverride === 'cat') {
                return CAT_PROMPT_OVERRIDE_INSTRUCTIONS;
            }
            throw new Error(`prompt override not found: ${promptOverride}`);
        },
    };
}
export function createPromptOverrideResolverWithFailures(failuresByPrompt: any) {
    return {
        async resolvePromptOverride(promptOverride: any) {
            if (failuresByPrompt.has(promptOverride)) {
                throw failuresByPrompt.get(promptOverride);
            }
            return createPromptOverrideResolver().resolvePromptOverride(promptOverride);
        },
    };
}
export function createUserTimelineMessage({ threadId, turnId, text }: any) {
    const messageId = createCanonicalUserMessageId({ turnId });
    return {
        id: messageId,
        kind: 'message',
        itemType: 'userMessage',
        role: 'user',
        text,
        state: 'complete',
        threadId,
        turnId,
        content: [{ type: 'text', text }],
        raw: {
            type: 'userMessage',
            id: messageId,
            content: [{ type: 'text', text }],
        },
    };
}
export function createAssistantTimelineMessage({ threadId, turnId, text, state }: any) {
    return {
        id: `assistant:${turnId}`,
        kind: 'message',
        itemType: 'agentMessage',
        role: 'assistant',
        text,
        state,
        threadId,
        turnId,
        raw: {
            type: 'agentMessage',
            id: `assistant:${turnId}`,
            text,
        },
    };
}
export function createLogger() {
    const warnings: any[] = [];
    return {
        warnings,
        logger: {
            warn(message: any) {
                warnings.push(message);
            },
        },
    };
}
