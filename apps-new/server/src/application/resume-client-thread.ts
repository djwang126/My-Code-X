import type { ClientActionResult, ClientResumeThreadAction } from '../contracts/index.js';
import type { ThreadService } from '../features/thread/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export type ResumeClientThreadInput = ClientResumeThreadAction;

export interface ResumeClientThreadDependencies {
  readonly thread: ThreadService;
}

export interface ResumeClientThreadUseCaseInput {
  readonly input: ResumeClientThreadInput;
  readonly dependencies: ResumeClientThreadDependencies;
}

export async function resumeClientThread(useCase: ResumeClientThreadUseCaseInput): Promise<ClientActionResult> {
  void useCase;
  throw new SkeletonMigrationPendingError('resumeClientThread');
}
