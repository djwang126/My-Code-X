import process from 'node:process';
import { createServer } from 'node:http';

import { stopChild } from '../my-code-x-managed-process.mjs';
import { disableManagedTailscaleServe, requestControlAction, sanitizeState } from './supervisor-state-files.mjs';
import {
  clearBackendState,
  clearProviderState,
  setStatus,
  stopBackendHealthWatchdog,
  writeState,
} from './supervisor-runtime-context.mjs';

export async function startControlServer(context, { restartBackend }) {
  const controlServer = createServer(async (request, response) => {
    const token = String(request.headers['x-my-code-x-control-token'] || '').trim();
    if (token !== context.controlToken) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('invalid control token');
      return;
    }

    if (request.method === 'GET' && request.url === '/status') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(sanitizeState(context.state)));
      return;
    }

    if (request.method === 'POST' && request.url === '/restart') {
      const alreadyRestarting = context.backendRestartInProgress;
      if (!alreadyRestarting) {
        restartBackend('restart').catch(async error => {
          context.state.status = 'failed';
          context.state.lastError = error instanceof Error ? error.message : String(error);
          await writeState(context);
        });
      }
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, restarting: true, alreadyRestarting }));
      return;
    }

    if (request.method === 'POST' && request.url === '/stop') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, stopping: true }));
      setImmediate(async () => {
        context.stopping = true;
        stopBackendHealthWatchdog(context);
        context.state.status = 'stopping';
        await writeState(context);
        await stopChild(context.providerChild);
        await stopChild(context.backendChild);

        let shutdownError = '';
        try {
          await disableManagedTailscaleServe();
        } catch (error) {
          shutdownError = error instanceof Error ? error.message : String(error);
        }

        clearProviderState(context);
        clearBackendState(context);
        setStatus(context, 'stopped', shutdownError);
        await writeState(context);
        controlServer.close(() => {
          process.exit(0);
        });
      });
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
  });

  await new Promise((resolve, reject) => {
    controlServer.once('error', reject);
    controlServer.listen(0, '127.0.0.1', () => {
      controlServer.off('error', reject);
      resolve();
    });
  });

  context.controlServer = controlServer;
  context.state.control.port = controlServer.address().port;
}

export function registerShutdownSignals(context) {
  process.once('SIGINT', () => {
    requestControlAction(context.state, 'POST', '/stop').catch(() => {
      process.exit(0);
    });
  });
  process.once('SIGTERM', () => {
    requestControlAction(context.state, 'POST', '/stop').catch(() => {
      process.exit(0);
    });
  });
}
