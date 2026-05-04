import type { ClientActionResult, ClientSnapshot } from '@my-code-x/contracts-new';
import type { ConversationService } from '../features/conversation/index.js';
import type { SlotService } from '../features/slot/index.js';
import type { ThreadActionsService } from '../features/thread-actions/index.js';
import type { ThreadService } from '../features/thread/index.js';
import type { TurnService } from '../features/turn/index.js';
import type { WorkspaceService } from '../features/workspace/index.js';
import type { RuntimePort } from '../ports/index.js';
import { interruptClientTurn, type InterruptClientTurnInput } from './interrupt-client-turn.js';
import { openClient, type OpenClientInput } from './open-client.js';
import { addWorkspace, type AddWorkspaceInput } from './add-workspace.js';
import { editWorkspaceCwd, type EditWorkspaceCwdInput } from './edit-workspace-cwd.js';
import { openWorkspacePanel, type OpenWorkspacePanelInput } from './open-workspace-panel.js';
import { removeWorkspace, type RemoveWorkspaceInput } from './remove-workspace.js';
import { renameWorkspace, type RenameWorkspaceInput } from './rename-workspace.js';
import { respondClientInteraction, type RespondClientInteractionInput } from './respond-client-interaction.js';
import { resumeClientThread, type ResumeClientThreadInput } from './resume-client-thread.js';
import { sendClientMessage, type SendClientMessageInput } from './send-client-message.js';

export type ApplicationOpenClientInput = OpenClientInput;
export type ApplicationSendClientMessageInput = SendClientMessageInput;
export type ApplicationResumeClientThreadInput = ResumeClientThreadInput;
export type ApplicationRespondClientInteractionInput = RespondClientInteractionInput;
export type ApplicationInterruptClientTurnInput = InterruptClientTurnInput;
export type ApplicationOpenWorkspacePanelInput = OpenWorkspacePanelInput;
export type ApplicationAddWorkspaceInput = AddWorkspaceInput;
export type ApplicationRenameWorkspaceInput = RenameWorkspaceInput;
export type ApplicationEditWorkspaceCwdInput = EditWorkspaceCwdInput;
export type ApplicationRemoveWorkspaceInput = RemoveWorkspaceInput;

export interface ApplicationInput {
  readonly conversation: ConversationService;
  readonly runtime: RuntimePort;
  readonly slot: SlotService;
  readonly thread: ThreadService;
  readonly threadActions: ThreadActionsService;
  readonly turn: TurnService;
  readonly workspace: WorkspaceService;
}

export interface ApplicationService {
  openClient(input: ApplicationOpenClientInput): Promise<ClientSnapshot>;
  sendClientMessage(input: ApplicationSendClientMessageInput): Promise<ClientActionResult>;
  resumeClientThread(input: ApplicationResumeClientThreadInput): Promise<ClientActionResult>;
  respondClientInteraction(input: ApplicationRespondClientInteractionInput): Promise<ClientActionResult>;
  interruptClientTurn(input: ApplicationInterruptClientTurnInput): Promise<ClientActionResult>;
  openWorkspacePanel(input: ApplicationOpenWorkspacePanelInput): Promise<ClientActionResult>;
  addWorkspace(input: ApplicationAddWorkspaceInput): Promise<ClientActionResult>;
  renameWorkspace(input: ApplicationRenameWorkspaceInput): Promise<ClientActionResult>;
  editWorkspaceCwd(input: ApplicationEditWorkspaceCwdInput): Promise<ClientActionResult>;
  removeWorkspace(input: ApplicationRemoveWorkspaceInput): Promise<ClientActionResult>;
}

export function createApplication(input: ApplicationInput): ApplicationService {
  return {
    openClient(command: ApplicationOpenClientInput): Promise<ClientSnapshot> {
      return openClient({ input: command, dependencies: input });
    },

    sendClientMessage(command: ApplicationSendClientMessageInput): Promise<ClientActionResult> {
      return sendClientMessage({ input: command, dependencies: input });
    },

    resumeClientThread(command: ApplicationResumeClientThreadInput): Promise<ClientActionResult> {
      return resumeClientThread({ input: command, dependencies: input });
    },

    respondClientInteraction(command: ApplicationRespondClientInteractionInput): Promise<ClientActionResult> {
      return respondClientInteraction({ input: command, dependencies: input });
    },

    interruptClientTurn(command: ApplicationInterruptClientTurnInput): Promise<ClientActionResult> {
      return interruptClientTurn({ input: command, dependencies: input });
    },

    openWorkspacePanel(command: ApplicationOpenWorkspacePanelInput): Promise<ClientActionResult> {
      return openWorkspacePanel({ input: command, dependencies: input });
    },

    addWorkspace(command: ApplicationAddWorkspaceInput): Promise<ClientActionResult> {
      return addWorkspace({ input: command, dependencies: input });
    },

    renameWorkspace(command: ApplicationRenameWorkspaceInput): Promise<ClientActionResult> {
      return renameWorkspace({ input: command, dependencies: input });
    },

    editWorkspaceCwd(command: ApplicationEditWorkspaceCwdInput): Promise<ClientActionResult> {
      return editWorkspaceCwd({ input: command, dependencies: input });
    },

    removeWorkspace(command: ApplicationRemoveWorkspaceInput): Promise<ClientActionResult> {
      return removeWorkspace({ input: command, dependencies: input });
    },
  };
}
