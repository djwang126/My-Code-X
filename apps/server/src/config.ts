import { homedir } from "node:os";
import path from "node:path";

export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
}

export interface LoadConfigInput {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export function loadConfig(input: LoadConfigInput = {}): ServerConfig {
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? homedir();
  const port = Number.parseInt(env.MY_CODE_X_PORT ?? "60120", 10);

  return {
    host: env.MY_CODE_X_HOST ?? "127.0.0.1",
    port: Number.isFinite(port) ? port : 60120,
    dataDir: env.MY_CODE_X_DATA_DIR ?? path.join(homeDir, ".my-code-x")
  };
}
