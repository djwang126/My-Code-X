import type { AppControlCommand, AppControlResult, AppControlService } from '../features/app-control/index.js';
import type { ChatCommand, ChatService, ChatSnapshot } from '../features/chat/index.js';
import type { SessionCommand, SessionService, SessionSnapshot } from '../features/session/index.js';
import type { ThreadCommand, ThreadService, ThreadSnapshot } from '../features/thread/index.js';
import type { WorkspaceCommand, WorkspaceService, WorkspaceSnapshot } from '../features/workspace/index.js';

export interface ApplicationInput {
  appControl: AppControlService;
  chat: ChatService;
  session: SessionService;
  thread: ThreadService;
  workspace: WorkspaceService;
}

export interface ApplicationService {
  runAppControl(input: AppControlCommand): Promise<AppControlResult>;
  runChat(input: ChatCommand): Promise<ChatSnapshot>;
  runSession(input: SessionCommand): Promise<SessionSnapshot>;
  runThread(input: ThreadCommand): Promise<ThreadSnapshot>;
  runWorkspace(input: WorkspaceCommand): Promise<WorkspaceSnapshot>;
}

export function createApplication(input: ApplicationInput): ApplicationService {
  return {
    runAppControl(command: AppControlCommand): Promise<AppControlResult> {
      return input.appControl.restart(command);
    },

    runChat(command: ChatCommand): Promise<ChatSnapshot> {
      return input.chat.send(command);
    },

    runSession(command: SessionCommand): Promise<SessionSnapshot> {
      return input.session.open(command);
    },

    runThread(command: ThreadCommand): Promise<ThreadSnapshot> {
      return input.thread.start(command);
    },

    runWorkspace(command: WorkspaceCommand): Promise<WorkspaceSnapshot> {
      return input.workspace.inspect(command);
    },
  };
}
