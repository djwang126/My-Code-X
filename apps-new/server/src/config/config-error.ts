export class ConfigError extends Error {
  constructor(
    public readonly key: string,
    public readonly reason: string,
  ) {
    super(`${key}: ${reason}`);
    this.name = 'ConfigError';
  }
}
