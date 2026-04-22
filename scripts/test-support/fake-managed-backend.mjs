import { createServer } from 'node:http';

const host = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
const port = Number.parseInt(String(process.env.PORT || '4310'), 10) || 4310;
const serverInstanceId = String(process.env.SERVER_INSTANCE_ID || `fake-${process.pid}`).trim() || `fake-${process.pid}`;
const authToken = String(process.env.MY_CODE_X_AUTH_TOKEN || '').trim();
const hangAfterMs = Number.parseInt(String(process.env.MY_CODE_X_FAKE_BACKEND_HANG_AFTER_MS || '0'), 10) || 0;
const hangDeadline = hangAfterMs > 0 ? Date.now() + hangAfterMs : 0;
const sockets = new Set();

function isAuthorized(request) {
  if (!authToken) {
    return true;
  }

  return String(request.headers.authorization || '') === `Bearer ${authToken}`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    if (!isAuthorized(request)) {
      response.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'unauthorized', authRequired: true }));
      return;
    }

    if (hangDeadline && Date.now() >= hangDeadline) {
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: true, authRequired: Boolean(authToken), serverInstanceId }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

function closeServerAndExit(exitCode) {
  for (const socket of sockets) {
    socket.destroy();
  }

  server.close(() => {
    process.exit(exitCode);
  });

  setTimeout(() => {
    process.exit(exitCode);
  }, 100).unref();
}

server.on('connection', socket => {
  sockets.add(socket);
  socket.on('close', () => {
    sockets.delete(socket);
  });
});

server.listen(port, host, () => {
  process.stdout.write(`fake backend listening on http://${host}:${port}\n`);
});

process.once('SIGINT', () => closeServerAndExit(0));
process.once('SIGTERM', () => closeServerAndExit(0));
