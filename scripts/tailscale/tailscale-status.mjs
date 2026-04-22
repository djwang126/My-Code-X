export function extractTailscaleStatusInfo(payload) {
  const ips = Array.isArray(payload?.Self?.TailscaleIPs)
    ? payload.Self.TailscaleIPs.filter(ip => typeof ip === 'string' && ip.trim())
    : [];
  const dnsName = typeof payload?.Self?.DNSName === 'string' ? payload.Self.DNSName.replace(/\.$/, '') : '';

  return {
    tailscaleIps: ips,
    dnsName,
  };
}

export function buildTailscaleServeUrl(dnsName) {
  const normalized = String(dnsName || '').trim().replace(/\.$/, '');
  return normalized ? `https://${normalized}/` : '';
}

export async function readTailscaleStatus(runTailscaleCommand) {
  let payload;
  try {
    const result = await runTailscaleCommand(['status', '--json'], { captureOutput: true });
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `Tailscale is not ready on this machine. Install/login to Tailscale first, then retry.\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return extractTailscaleStatusInfo(payload);
}

export async function readTailscaleServeConfig(runTailscaleCommand) {
  let payload;
  try {
    const result = await runTailscaleCommand(['serve', 'status', '--json'], { captureOutput: true });
    payload = JSON.parse(result.stdout || '{}');
  } catch (error) {
    throw new Error(`Failed to read Tailscale Serve status.\n${error instanceof Error ? error.message : String(error)}`);
  }

  const configured =
    Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length > 0;

  return {
    configured,
    payload,
  };
}
