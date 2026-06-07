import { createServer } from "node:http";
import type { createApp } from "../create-app";

export async function withListeningServer(
  testApp: ReturnType<typeof createApp>,
  run: (baseUrl: string) => Promise<void>
) {
  const server = createServer(testApp);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected server to listen on a TCP address");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}
