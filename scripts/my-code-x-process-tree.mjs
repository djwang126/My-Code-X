import process from 'node:process';
import { spawn } from 'node:child_process';

function runCapturedCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr?.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error((stderr || stdout).trim() || `${command} exited with code ${code}`));
    });
  });
}

function parseWindowsProcessList(stdout) {
  return stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => Number.isInteger(entry.pid) && entry.pid > 0);
}

function parsePosixProcessList(stdout) {
  return stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
      if (!match) {
        return null;
      }

      const [, pidText, ppidText, name, commandLine] = match;
      return {
        pid: Number.parseInt(pidText, 10),
        ppid: Number.parseInt(ppidText, 10),
        name,
        commandLine: commandLine || '',
      };
    })
    .filter(Boolean);
}

export async function listSystemProcesses() {
  if (process.platform === 'win32') {
    const stdout = await runCapturedCommand('powershell', [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine | ForEach-Object { [PSCustomObject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = [string]$_.Name; commandLine = [string]$_.CommandLine } | ConvertTo-Json -Compress }",
    ]);
    return parseWindowsProcessList(stdout);
  }

  const stdout = await runCapturedCommand('ps', ['-axo', 'pid=,ppid=,comm=,args=']);
  return parsePosixProcessList(stdout);
}

export function collectDescendantPids(processes, rootPids) {
  const childMap = new Map();
  for (const processRecord of processes) {
    const siblings = childMap.get(processRecord.ppid) || [];
    siblings.push(processRecord.pid);
    childMap.set(processRecord.ppid, siblings);
  }

  const seen = new Set();
  const pending = [...rootPids];

  while (pending.length) {
    const pid = pending.pop();
    if (!pid || seen.has(pid)) {
      continue;
    }

    seen.add(pid);
    const childPids = childMap.get(pid) || [];
    pending.push(...childPids);
  }

  return seen;
}

export function pruneDescendantRootPids(processes, candidateRootPids) {
  const candidateSet = new Set(candidateRootPids.filter(pid => Number.isInteger(pid) && pid > 0));
  const parentByPid = new Map(processes.map(processRecord => [processRecord.pid, processRecord.ppid]));

  return [...candidateSet].filter(pid => {
    let currentPid = parentByPid.get(pid) || 0;
    while (currentPid) {
      if (candidateSet.has(currentPid)) {
        return false;
      }
      currentPid = parentByPid.get(currentPid) || 0;
    }
    return true;
  });
}

export async function terminateProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  if (process.platform === 'win32') {
    try {
      await runCapturedCommand('taskkill', ['/PID', String(pid), '/T', '/F']);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|no running instance|cannot find/i.test(message)) {
        return false;
      }
      throw error;
    }
  }

  const processes = await listSystemProcesses();
  const pids = [...collectDescendantPids(processes, [pid])].sort((left, right) => right - left);

  for (const currentPid of pids) {
    try {
      process.kill(currentPid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') {
        throw error;
      }
    }
  }

  return true;
}
