import type {
  CliKind,
  Message,
  MessageContent
} from "@my-code-x/app-types";

import {
  type ClassificationDecision,
  assertMessageHasStableKey
} from "./protocol-invariants";

export interface ProjectClassifiedMessageInput {
  cliKind: CliKind;
  decision: ClassificationDecision;
  stableKey: string | null | undefined;
  sequence: number;
  nativeType: string | null;
  nativeStatus: string | null;
  belongsToTurn: string | null;
  content: MessageContent;
}

export function projectClassifiedMessage(
  input: ProjectClassifiedMessageInput
): Message | null {
  if (input.decision.kind === "Ignored") {
    return null;
  }

  assertMessageHasStableKey({
    cliKind: input.cliKind,
    nativeType: input.nativeType,
    stableKey: input.stableKey
  });

  const stableKey = input.stableKey;
  if (stableKey === undefined || stableKey === null || stableKey === "") {
    return null;
  }

  return {
    stableKey,
    sequence: input.sequence,
    classification: input.decision.classification,
    nativeType: input.nativeType,
    nativeStatus: input.nativeStatus,
    belongsToTurn: input.belongsToTurn,
    content: input.content
  };
}
