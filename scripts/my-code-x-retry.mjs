import { sleep } from './my-code-x-managed-process.mjs';

export function getRetryBackoffMs(attempt, { baseMs = 500, maxMs = 5_000 } = {}) {
  return Math.min(baseMs * 2 ** (Math.max(1, attempt) - 1), maxMs);
}

export async function retryWithBackoff({
  maxAttempts,
  shouldContinue = () => true,
  beforeAttempt,
  attempt,
  onError,
  backoffMs = currentAttempt => getRetryBackoffMs(currentAttempt),
  sleepFn = sleep,
}) {
  for (let currentAttempt = 1; currentAttempt <= maxAttempts && shouldContinue(); currentAttempt += 1) {
    await beforeAttempt?.({ attempt: currentAttempt, isFirstAttempt: currentAttempt === 1 });

    try {
      return await attempt({ attempt: currentAttempt, isLastAttempt: currentAttempt === maxAttempts });
    } catch (error) {
      const isLastAttempt = currentAttempt === maxAttempts || !shouldContinue();
      await onError?.(error, {
        attempt: currentAttempt,
        isFirstAttempt: currentAttempt === 1,
        isLastAttempt,
      });

      if (isLastAttempt) {
        throw error;
      }

      await sleepFn(backoffMs(currentAttempt));
    }
  }

  return undefined;
}
