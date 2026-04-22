import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const statePath = String(process.env.MY_CODE_X_TAILSCALE_STATE_PATH || '').trim();
const dnsName = String(process.env.MY_CODE_X_TAILSCALE_DNS_NAME || 'fake-node.example.ts.net')
  .trim()
  .replace(/\.$/, '');

function parseIps() {
  try {
    const parsed = JSON.parse(String(process.env.MY_CODE_X_TAILSCALE_IPS_JSON || '["100.64.0.10"]'));
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string' && value.trim()) : [];
  } catch {
    return ['100.64.0.10'];
  }
}

async function writeState(nextState) {
  if (!statePath) {
    return;
  }

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
}

if (args[0] === 'status' && args[1] === '--json') {
  process.stdout.write(
    JSON.stringify({
      Self: {
        DNSName: dnsName,
        TailscaleIPs: parseIps(),
      },
    }),
  );
  process.exit(0);
}

if (args[0] === 'serve' && args[1] === 'status' && args[2] === '--json') {
  let state = null;
  if (statePath) {
    try {
      state = JSON.parse(await fs.readFile(statePath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  process.stdout.write(JSON.stringify(state?.enabled ? { Web: { HTTPS: state.args?.at(-1) || '' } } : {}));
  process.exit(0);
}

if (args[0] === 'serve' && args.includes('off')) {
  await writeState({
    enabled: false,
    args,
  });
  process.stdout.write('Serve disabled\n');
  process.exit(0);
}

if (args[0] === 'serve') {
  await writeState({
    enabled: true,
    args,
  });
  process.stdout.write(`Available within your tailnet:\nhttps://${dnsName}\n`);
  process.exit(0);
}

process.stderr.write(`Unsupported fake tailscale invocation: ${args.join(' ')}\n`);
process.exit(1);
