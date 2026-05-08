export type ChatTodoStatus = 'pending' | 'inProgress' | 'completed';

export type ChatTodoStep = {
  step: string;
  status: ChatTodoStatus;
};

export type ActiveChatTodo = {
  key: string;
  turnId: string | null;
  explanation: string;
  total: number;
  completed: number;
  steps: ChatTodoStep[];
};
