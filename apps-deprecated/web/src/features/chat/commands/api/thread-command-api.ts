import type {
  ThreadCompactAcceptedPayload,
  ThreadForkAcceptedPayload,
  ThreadRollbackAcceptedPayload,
} from '@my-code-x/contracts';
import { postJson } from '../../../../shared/lib/app-api-client';

export async function postThreadCompactStart({
  slotId,
  threadId,
  workspace,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
}): Promise<ThreadCompactAcceptedPayload> {
  return postJson<ThreadCompactAcceptedPayload>({
    url: '/api/v2/thread/compact',
    body: {
      slotId,
      threadId,
      workspace,
    },
  });
}

export async function postThreadRollback({
  slotId,
  threadId,
  workspace,
  numTurns,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
  numTurns: number;
}): Promise<ThreadRollbackAcceptedPayload> {
  return postJson<ThreadRollbackAcceptedPayload>({
    url: '/api/v2/thread/rollback',
    body: {
      slotId,
      threadId,
      workspace,
      numTurns,
    },
  });
}

export async function postThreadFork({
  slotId,
  threadId,
  workspace,
  preservedTurnCount,
}: {
  slotId: string;
  threadId: string;
  workspace: string;
  preservedTurnCount: number;
}): Promise<ThreadForkAcceptedPayload> {
  return postJson<ThreadForkAcceptedPayload>({
    url: '/api/v2/thread/fork',
    body: {
      slotId,
      threadId,
      workspace,
      preservedTurnCount,
    },
  });
}
