import process from 'node:process';

export function formatCliErrorMessage(error) {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  const fallback = String(error ?? 'Unknown error').trim();
  return fallback || 'Unknown error';
}

export function printCliError(error) {
  const message = formatCliErrorMessage(error);
  process.stderr.write(`${message}\n`);
}
