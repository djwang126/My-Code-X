import { SkeletonMigrationPendingError } from '../../shared/index.js';

export type AppControlCommand = unknown;
export type AppControlResult = unknown;

export interface AppControlService {
  restart(input: AppControlCommand): Promise<AppControlResult>;
}

export function createAppControlService(): AppControlService {
  return {
    async restart(input: AppControlCommand): Promise<AppControlResult> {
      void input;
      throw new SkeletonMigrationPendingError('appControl.restart');
    },
  };
}
