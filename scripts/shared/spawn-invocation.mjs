import process from 'node:process';

function quoteForCmd(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatCmdArgument(value) {
  const text = String(value);
  return /[\s"&|<>^()]/.test(text) ? quoteForCmd(text) : text;
}

export function resolveSpawnInvocation(command, args) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [command, ...args].map(formatCmdArgument).join(' ')],
    };
  }

  return {
    command,
    args,
  };
}
