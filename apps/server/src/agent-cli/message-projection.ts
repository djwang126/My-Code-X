import type {
  CliKind,
  Message,
  MessageContent
} from "@my-code-x/app-types";

import {
  type ClassificationDecision,
  requireStableKey
} from "./protocol-invariants";

export interface ProjectMessageFromClassificationDecisionInput {
  cliKind: CliKind;
  decision: ClassificationDecision;
  stableKey: string | null | undefined;
  sequence: number;
  nativeType: string | null;
  nativeStatus: string | null;
  belongsToTurn: string | null;
  content: MessageContent;
}

export function projectMessageFromClassificationDecision(
  input: ProjectMessageFromClassificationDecisionInput
): Message | null {
  if (input.decision.kind === "Ignored") {
    return null;
  }

  const stableKey = requireStableKey({
    cliKind: input.cliKind,
    nativeType: input.nativeType,
    stableKey: input.stableKey
  });

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
