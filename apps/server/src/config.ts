export interface ServerConfig {
  host: string;
  port: number;
}

export interface LoadConfigInput {
  env?: NodeJS.ProcessEnv;
}

export function loadConfig(input: LoadConfigInput = {}): ServerConfig {
  const env = input.env ?? process.env;
  const port = Number.parseInt(env.MY_CODE_X_PORT ?? "60120", 10);

  return {
    host: env.MY_CODE_X_HOST ?? "127.0.0.1",
    port: Number.isFinite(port) ? port : 60120
  };
}
