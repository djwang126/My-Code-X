function stripIpv6Brackets(host) {
  const trimmed = String(host || '').trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function getBindHost(mode, explicitHost) {
  if (explicitHost) {
    return explicitHost;
  }

  return mode === 'cloudflare' || mode === 'tailscale' ? '127.0.0.1' : '0.0.0.0';
}

export function extractCloudflareQuickTunnelUrl(logText) {
  const match = String(logText || '').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
  return match ? match[0] : '';
}

export function getAccessHost(bindHost) {
  const normalizedHost = stripIpv6Brackets(bindHost);

  if (
    !normalizedHost ||
    normalizedHost === '0.0.0.0' ||
    normalizedHost === '::' ||
    normalizedHost === '0:0:0:0:0:0:0:0'
  ) {
    return '127.0.0.1';
  }

  return normalizedHost;
}

export function formatHostForUrl(host) {
  const normalizedHost = stripIpv6Brackets(host);
  return normalizedHost.includes(':') ? `[${normalizedHost}]` : normalizedHost;
}

export function buildHttpUrl(host, port, pathname = '/') {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const accessHost = getAccessHost(host);
  return `http://${formatHostForUrl(accessHost)}:${port}${normalizedPath}`;
}
