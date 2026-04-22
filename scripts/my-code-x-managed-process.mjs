import fs from 'node:fs';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForProcessExit(pid, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await sleep(100);
  }
  return !isProcessRunning(pid);
}

export async function runCommand(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    captureOutput = false,
    stdio = 'ignore',
  } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : stdio,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr?.on('data', chunk => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(
        captureOutput && (stderr || stdout)
          ? (stderr || stdout).trim()
          : `${command} exited with code ${code}`,
      );
      reject(error);
    });
  });
}

export function startManagedProcess(command, args, { cwd = process.cwd(), env, outLogPath, errLogPath, onStdout, onStderr }) {
  const stdoutStream = fs.createWriteStream(outLogPath, { flags: 'a' });
  const stderrStream = fs.createWriteStream(errLogPath, { flags: 'a' });
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let streamsClosed = false;

  function closeStreams() {
    if (streamsClosed) {
      return;
    }

    streamsClosed = true;
    stdoutStream.end();
    stderrStream.end();
  }

  const spawned = new Promise((resolve, reject) => {
    let settled = false;

    child.once('spawn', () => {
      settled = true;
      resolve();
    });

    child.once('error', error => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    });
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', chunk => {
    stdoutStream.write(chunk);
    onStdout?.(chunk);
  });
  child.stderr?.on('data', chunk => {
    stderrStream.write(chunk);
    onStderr?.(chunk);
  });
  child.on('close', closeStreams);
  child.on('error', error => {
    stderrStream.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    closeStreams();
  });

  return { child, spawned };
}

export async function stopChild(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    child.kill(signal);
  } catch {
    return;
  }

  await Promise.race([once(child, 'exit').catch(() => {}), sleep(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit').catch(() => {});
  }
}

export async function stopProcessByPid(pid, signal = 'SIGTERM') {
  if (!pid || !isProcessRunning(pid)) {
    return false;
  }

  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
    return false;
  }

  const exited = await waitForProcessExit(pid, 5_000);
  if (!exited && isProcessRunning(pid)) {
    process.kill(pid, 'SIGKILL');
    await waitForProcessExit(pid, 5_000);
  }

  return !isProcessRunning(pid);
}
