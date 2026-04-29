export type AppControlCommand = unknown;
export type AppControlResult = unknown;

export interface AppControlService {
  restart(input: AppControlCommand): Promise<AppControlResult>;
}

export function createAppControlService(): AppControlService {
  return {
    async restart(input: AppControlCommand): Promise<AppControlResult> {
      return input;
    },
  };
}