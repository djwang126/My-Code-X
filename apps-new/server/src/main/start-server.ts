import { createAppComposition } from './composition-root.js';
import { registerShutdown } from './shutdown.js';

export interface StartedServer {
  close(): Promise<void>;
}

export async function startServer(): Promise<StartedServer> {
  const composition = await createAppComposition();
  registerShutdown(composition);

  return {
    close() {
      return composition.close();
    },
  };
}
