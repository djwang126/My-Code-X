function isClientStreamDebugEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return (
      window.localStorage.getItem('my-code-x-debug-stream-timing') === '1' ||
      window.sessionStorage.getItem('my-code-x-debug-stream-timing') === '1'
    );
  } catch {
    return false;
  }
}

export function logClientStreamDebug(stage: string, details: Record<string, unknown> = {}) {
  if (!isClientStreamDebugEnabled()) {
    return;
  }

  console.info('[my-code-x-debug]', {
    ts: new Date().toISOString(),
    scope: 'client-stream',
    stage,
    ...details,
  });
}

