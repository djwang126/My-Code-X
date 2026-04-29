import type { ClientOpenAction, ClientSnapshot } from '../contracts/index.js';
import type { ConversationService } from '../features/conversation/index.js';
import type { RuntimeRequestService } from '../features/runtime-request/index.js';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import { createClientSnapshot } from '../presenter/index.js';
import { BoundaryError } from '../shared/index.js';

export type OpenClientInput = ClientOpenAction;

export interface OpenClientDependencies {
  readonly conversation: ConversationService;
  readonly runtimeRequests: RuntimeRequestService;
  readonly slot: SlotService;
  readonly thread: ThreadService;
  readonly turn: TurnService;
  readonly workspace: WorkspaceService;
}

export interface OpenClientUseCaseInput {
  readonly input: OpenClientInput;
  readonly dependencies: OpenClientDependencies;
}

export async function openClient(useCase: OpenClientUseCaseInput): Promise<ClientSnapshot> {
  const slotId = readRequiredScopeValue(useCase.input.scope.slotId, 'slotId');
  const slot = useCase.dependencies.slot.open({
    slotId,
    workspace: useCase.input.scope.workspaceId,
    threadId: useCase.input.scope.threadId,
  });
  const workspace = await useCase.dependencies.workspace.inspect({
    kind: 'inspect-workspace',
    workspace: useCase.input.scope.workspaceId,
  });

  return createClientSnapshot({
    revision: 'initial',
    slot,
    thread: useCase.dependencies.thread.snapshot(),
    turn: useCase.dependencies.turn.snapshot(),
    conversation: useCase.dependencies.conversation.snapshot(),
    runtimeRequests: useCase.dependencies.runtimeRequests.snapshot(),
    workspace,
  });
}

function readRequiredScopeValue(value: string | null, fieldName: string): string {
  if (!value) {
    throw new BoundaryError(`client action scope.${fieldName} is required`);
  }

  return value;
}
