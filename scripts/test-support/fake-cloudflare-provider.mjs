const publishedUrl =
  String(process.env.MY_CODE_X_PROVIDER_URL || 'https://fake-provider.trycloudflare.com').trim() ||
  'https://fake-provider.trycloudflare.com';

process.stdout.write(`INF Published tunnel URL: ${publishedUrl}\n`);

const heartbeat = setInterval(() => {
  process.stdout.write(`INF Heartbeat ${publishedUrl}\n`);
}, 1_000);

function shutdown(exitCode) {
  globalThis.clearInterval(heartbeat);
  process.exit(exitCode);
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
