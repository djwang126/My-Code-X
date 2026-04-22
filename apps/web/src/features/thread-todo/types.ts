export type ThreadTodoStatus = 'pending' | 'inProgress' | 'completed';

export type ThreadTodoStep = {
  step: string;
  status: ThreadTodoStatus;
};

export type ActiveThreadTodo = {
  key: string;
  turnId: string | null;
  explanation: string;
  total: number;
  completed: number;
  steps: ThreadTodoStep[];
};
