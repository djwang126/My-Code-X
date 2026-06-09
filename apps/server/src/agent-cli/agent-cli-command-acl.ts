import type {
  AgentCapability,
  AgentCliCommand,
  AgentCliCommandResult
} from "@my-code-x/app-types";

type SubmitNormalInputCommand = Extract<
  AgentCliCommand,
  { kind: "SubmitNormalInput" }
>;
type AppendInstructionCommand = Extract<
  AgentCliCommand,
  { kind: "AppendInstruction" }
>;
type RequestWorkInterruptCommand = Extract<
  AgentCliCommand,
  { kind: "RequestWorkInterrupt" }
>;
type RespondToInteractionCommand = Extract<
  AgentCliCommand,
  { kind: "RespondToInteraction" }
>;

export interface AgentCliCommandBoundary {
  submitNormalInput(
    command: SubmitNormalInputCommand
  ): Promise<AgentCliCommandResult>;
  appendInstruction(
    command: AppendInstructionCommand
  ): Promise<AgentCliCommandResult>;
  requestWorkInterrupt(
    command: RequestWorkInterruptCommand
  ): Promise<AgentCliCommandResult>;
  respondToInteraction(
    command: RespondToInteractionCommand
  ): Promise<AgentCliCommandResult>;
}

export interface AgentCliCommandAcl {
  sendCommand(command: AgentCliCommand): Promise<AgentCliCommandResult>;
}

export interface CreateAgentCliCommandAclInput {
  boundary: AgentCliCommandBoundary;
  capability: AgentCapability;
}

export function createAgentCliCommandAcl(
  input: CreateAgentCliCommandAclInput
): AgentCliCommandAcl {
  return {
    async sendCommand(command) {
      try {
        return await sendSupportedCommand(input, command);
      } catch (error) {
        return {
          kind: "failed",
          reason: "relayFailed",
          message: relayFailureMessage(error)
        };
      }
    }
  };
}

async function sendSupportedCommand(
  input: CreateAgentCliCommandAclInput,
  command: AgentCliCommand
): Promise<AgentCliCommandResult> {
  switch (command.kind) {
    case "SubmitNormalInput":
      return input.boundary.submitNormalInput(command);
    case "AppendInstruction":
      if (!input.capability.supportsAppend) {
        return {
          kind: "failed",
          reason: "unsupportedCapability",
          message: "agent cli does not support appending instructions"
        };
      }
      return input.boundary.appendInstruction(command);
    case "RequestWorkInterrupt":
      if (!input.capability.supportsInterrupt) {
        return {
          kind: "failed",
          reason: "unsupportedCapability",
          message: "agent cli does not support interrupting work"
        };
      }
      return input.boundary.requestWorkInterrupt(command);
    case "RespondToInteraction":
      return input.boundary.respondToInteraction(command);
  }
}

function relayFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "agent cli command relay failed";
}
