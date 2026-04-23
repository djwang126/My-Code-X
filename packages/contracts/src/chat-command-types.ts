export type ThreadCompactAcceptedPayload = {
  ok: boolean;
  threadId: string;
};

export type ThreadRollbackAcceptedPayload = {
  ok: boolean;
  threadId: string;
};

export type ThreadForkAcceptedPayload = {
  ok: boolean;
  threadId: string;
};
