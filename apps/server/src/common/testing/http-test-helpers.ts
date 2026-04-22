import { createServer, type ServerResponse, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
type HttpApp = (request: IncomingMessage, response: ServerResponse<IncomingMessage>) => void | Promise<void>;
interface WithServerInput {
    port: number;
}
export async function withServer(app: HttpApp, run: (input: WithServerInput) => Promise<void>) {
    const server = createServer(app);
    await new Promise<void>((resolve: any) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
        throw new Error('server address is unavailable');
    }
    try {
        await run({ port: (address as AddressInfo).port });
    }
    finally {
        await new Promise<void>((resolve: any, reject: any) => server.close((error: any) => (error ? reject(error) : resolve())));
    }
}
