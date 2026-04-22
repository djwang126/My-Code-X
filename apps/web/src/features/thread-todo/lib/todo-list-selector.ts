import type { SessionNotice } from '../../chat-runtime/public-types';
import type { ActiveThreadTodo, ThreadTodoStatus, ThreadTodoStep } from '../types';

type ParsedTodoNotice = ActiveThreadTodo & {
  noticeId: string;
};

function normalizeTodoStatus(value: unknown): ThreadTodoStatus {
  if (value === 'completed' || value === 'inProgress' || value === 'pending') {
    return value;
  }

  return 'pending';
}

function normalizeTodoSteps(value: unknown): ThreadTodoStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(entry => {
      const step = typeof entry?.step === 'string' ? entry.step.trim() : '';

      if (!step) {
        return null;
      }

      return {
        step,
        status: normalizeTodoStatus(entry?.status),
      };
    })
    .filter((entry): entry is ThreadTodoStep => Boolean(entry));
}

function buildTodoFingerprint(input: {
  threadId: string;
  turnId: string | null;
  explanation: string;
  steps: ThreadTodoStep[];
}) {
  return JSON.stringify(input);
}

function parseTodoNotice(notice: SessionNotice | undefined, threadId: string): ParsedTodoNotice | null {
  if (!notice || !threadId.trim()) {
    return null;
  }

  const raw = notice.raw;

  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // Upstream Codex still sends the thread todo list under its `update_plan`
  // notice shape. Inside My-Code-X this payload belongs to the todo domain,
  // never the separate proposed-plan / plan-mode domain.
  const noticeThreadId = typeof raw.threadId === 'string' ? raw.threadId.trim() : '';

  if (!noticeThreadId || noticeThreadId !== threadId) {
    return null;
  }

  const steps = normalizeTodoSteps(raw.plan);

  if (!steps.length) {
    return null;
  }

  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const turnId = typeof raw.turnId === 'string' ? raw.turnId : null;
  const completed = steps.filter(step => step.status === 'completed').length;

  return {
    noticeId: notice.id,
    key: buildTodoFingerprint({ threadId: noticeThreadId, turnId, explanation, steps }),
    turnId,
    explanation,
    total: steps.length,
    completed,
    steps,
  };
}

export function selectThreadTodoState(notices: SessionNotice[] | undefined, threadId: string) {
  const safeNotices = notices ?? [];

  if (!safeNotices.length || !threadId.trim()) {
    return {
      activeTodo: null,
      hiddenNoticeIds: new Set<string>(),
      visibleNotices: safeNotices,
    };
  }

  const parsedTodoNotices = safeNotices.map(notice => ({
    notice,
    parsed: parseTodoNotice(notice, threadId),
  }));

  let activeTodoNotice: (typeof parsedTodoNotices)[number] | null = null;

  for (let index = parsedTodoNotices.length - 1; index >= 0; index -= 1) {
    if (parsedTodoNotices[index]?.parsed) {
      activeTodoNotice = parsedTodoNotices[index];
      break;
    }
  }

  if (!activeTodoNotice?.parsed) {
    return {
      activeTodo: null,
      hiddenNoticeIds: new Set<string>(),
      visibleNotices: safeNotices,
    };
  }

  const hiddenNoticeIds = new Set(parsedTodoNotices.filter(entry => entry.parsed).map(entry => entry.notice.id));

  return {
    activeTodo: {
      key: activeTodoNotice.parsed.key,
      turnId: activeTodoNotice.parsed.turnId,
      explanation: activeTodoNotice.parsed.explanation,
      total: activeTodoNotice.parsed.total,
      completed: activeTodoNotice.parsed.completed,
      steps: activeTodoNotice.parsed.steps,
    },
    hiddenNoticeIds,
    visibleNotices: safeNotices.filter(notice => !hiddenNoticeIds.has(notice.id)),
  };
}
