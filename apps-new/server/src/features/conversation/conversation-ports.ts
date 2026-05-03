import type { EventBusPort } from '../../ports/index.js';

export interface ConversationDependencies {
  readonly events: EventBusPort;
  readonly scheduler?: ConversationSchedulerPort;
}

export interface ConversationSchedulerPort {
  schedule(input: ScheduleConversationFlushInput): ConversationScheduledTask;
}

export interface ScheduleConversationFlushInput {
  readonly delayMs: number;
  run(): void;
}

export interface ConversationScheduledTask {
  cancel(): void;
}

export function createTimeoutConversationScheduler(): ConversationSchedulerPort {
  return {
    schedule(input: ScheduleConversationFlushInput): ConversationScheduledTask {
      const timeout = setTimeout(input.run, input.delayMs);

      return {
        cancel() {
          clearTimeout(timeout);
        },
      };
    },
  };
}
