export interface AppConfig {
  readonly appName: string;
}

export function readAppConfig(): AppConfig {
  return {
    appName: 'My-Code-X',
  };
}
