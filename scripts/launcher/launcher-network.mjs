import os from 'node:os';

function isLanIpv4Address(address) {
  const octets = String(address || '')
    .trim()
    .split('.')
    .map(part => Number.parseInt(part, 10));

  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  return first === 192 && second === 168;
}

export function collectLanIpv4Addresses(networkInterfaces = os.networkInterfaces()) {
  const addresses = [];

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4' || !isLanIpv4Address(entry.address)) {
        continue;
      }

      if (!addresses.includes(entry.address)) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses;
}

export function printExposureSummary({ state, exposeMode, port }) {
  const localUrl = state?.localUrl || `http://127.0.0.1:${port}/`;
  process.stdout.write(`My-Code-X is ready at:\n  ${localUrl}\n`);

  if (exposeMode === 'lan') {
    const lanUrls = collectLanIpv4Addresses().map(address => `http://${address}:${port}/`);
    if (lanUrls.length) {
      process.stdout.write(`LAN URLs:\n${lanUrls.map(url => `  ${url}`).join('\n')}\n`);
      process.stdout.write('LAN access may still require allowing Node through your OS firewall.\n');
    } else {
      process.stdout.write('No non-loopback IPv4 address was detected. The app is still reachable on localhost.\n');
    }
  }

  if (exposeMode === 'tailscale') {
    process.stdout.write('Tailscale mode uses Tailscale Serve to publish an HTTPS ts.net URL inside your tailnet.\n');
  }

  if (Array.isArray(state?.exposureUrls) && state.exposureUrls.length) {
    process.stdout.write(`Shared URLs:\n${state.exposureUrls.map(url => `  ${url}`).join('\n')}\n`);
  }
}
