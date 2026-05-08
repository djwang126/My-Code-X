import { createServer } from 'node:http';
export async function withServer(app, run) {
    const server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('server address is unavailable');
    }
    try {
        await run({ port: address.port });
    }
    finally {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
}
//# sourceMappingURL=http-test-helpers.js.map