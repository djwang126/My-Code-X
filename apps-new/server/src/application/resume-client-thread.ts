import type { ClientActionResult, ClientResumeThreadAction } from '@my-code-x/contracts-new';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import type { ThreadService } from '../features/thread/index.js';
import { SkeletonMigrationPendingError } from '../shared/index.js';

export type ResumeClientThreadInput = ClientResumeThreadAction;

export interface ResumeClientThreadDependencies {
  readonly slot: SlotService;
  readonly thread: ThreadService;
  readonly threadActions: ThreadActionsService;
}

export interface ResumeClientThreadUseCaseInput {
  readonly input: ResumeClientThreadInput;
  readonly dependencies: ResumeClientThreadDependencies;
}

export async function resumeClientThread(useCase: ResumeClientThreadUseCaseInput): Promise<ClientActionResult> {
  void useCase;
  throw new SkeletonMigrationPendingError('resumeClientThread');
}
