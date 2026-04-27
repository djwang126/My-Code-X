import type { AppControlCommand, AppControlResult, AppControlService } from '../features/app-control/index.js';
import type { ChatCommand, ChatService, ChatSnapshot } from '../features/chat/index.js';
import type { SessionCommand, SessionService, SessionSnapshot } from '../features/session/index.js';
import type { ThreadCommand, ThreadService, ThreadSnapshot } from '../features/thread/index.js';
import type { WorkspaceCommand, WorkspaceService, WorkspaceSnapshot } from '../features/workspace/index.js';

export type ApplicationAppControlCommand = AppControlCommand;
export type ApplicationAppControlResult = AppControlResult;
export type ApplicationChatCommand = ChatCommand;
export type ApplicationChatSnapshot = ChatSnapshot;
export type ApplicationSessionCommand = SessionCommand;
export type ApplicationSessionSnapshot = SessionSnapshot;
export type ApplicationThreadCommand = ThreadCommand;
export type ApplicationThreadSnapshot = ThreadSnapshot;
export type ApplicationWorkspaceCommand = WorkspaceCommand;
export type ApplicationWorkspaceSnapshot = WorkspaceSnapshot;

export interface ApplicationInput {
  appControl: AppControlService;
  chat: ChatService;
  session: SessionService;
  thread: ThreadService;
  workspace: WorkspaceService;
}

export interface ApplicationService {
  runAppControl(input: ApplicationAppControlCommand): Promise<ApplicationAppControlResult>;
  runChat(input: ApplicationChatCommand): Promise<ApplicationChatSnapshot>;
  runSession(input: ApplicationSessionCommand): Promise<ApplicationSessionSnapshot>;
  runThread(input: ApplicationThreadCommand): Promise<ApplicationThreadSnapshot>;
  runWorkspace(input: ApplicationWorkspaceCommand): Promise<ApplicationWorkspaceSnapshot>;
}

export function createApplication(input: ApplicationInput): ApplicationService {
  return {
    runAppControl(command: ApplicationAppControlCommand): Promise<ApplicationAppControlResult> {
      return input.appControl.restart(command);
    },

    runChat(command: ApplicationChatCommand): Promise<ApplicationChatSnapshot> {
      return input.chat.send(command);
    },

    runSession(command: ApplicationSessionCommand): Promise<ApplicationSessionSnapshot> {
      return input.session.open(command);
    },

    runThread(command: ApplicationThreadCommand): Promise<ApplicationThreadSnapshot> {
      return input.thread.start(command);
    },

    runWorkspace(command: ApplicationWorkspaceCommand): Promise<ApplicationWorkspaceSnapshot> {
      return input.workspace.inspect(command);
    },
  };
}
