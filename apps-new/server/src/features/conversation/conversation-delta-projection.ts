import type { JsonObject, JsonValue } from '../../ports/index.js';
import type { ConversationDeltaProjectionState } from './conversation-delta-accumulator.js';
import type { ConversationItem, ConversationWorkTraceItem } from './conversation-events.js';
import { projectConversationItemFields } from './conversation-field-projection.js';

export interface ProjectRuntimeDeltaStateInput {
  readonly state: ConversationDeltaProjectionState;
}

export function projectRuntimeDeltaState(input: ProjectRuntimeDeltaStateInput): ConversationItem {
  switch (input.state.kind) {
    case 'agentMessage':
      return {
        id: input.state.itemId,
        kind: 'message',
        role: 'assistant',
        text: input.state.text,
      };

    case 'plan':
      return projectSyntheticWorkTrace({
        itemId: input.state.itemId,
        codexType: 'plan',
        raw: {
          id: input.state.itemId,
          type: 'plan',
          text: input.state.text,
        },
      });

    case 'reasoning':
      return projectSyntheticWorkTrace({
        itemId: input.state.itemId,
        codexType: 'reasoning',
        raw: {
          id: input.state.itemId,
          type: 'reasoning',
          summary: input.state.summary,
          content: input.state.content,
        },
      });

    case 'commandExecution':
      return projectSyntheticWorkTrace({
        itemId: input.state.itemId,
        codexType: 'commandExecution',
        raw: {
          id: input.state.itemId,
          type: 'commandExecution',
          aggregatedOutput: input.state.aggregatedOutput,
          terminalInput: input.state.terminalInput,
        },
      });

    case 'fileChange':
      return projectSyntheticWorkTrace({
        itemId: input.state.itemId,
        codexType: 'fileChange',
        raw: {
          id: input.state.itemId,
          type: 'fileChange',
          output: input.state.output,
          changes: input.state.changes,
        },
      });

    case 'mcpToolCall':
      return projectSyntheticWorkTrace({
        itemId: input.state.itemId,
        codexType: 'mcpToolCall',
        raw: {
          id: input.state.itemId,
          type: 'mcpToolCall',
          progressMessages: input.state.progressMessages,
        },
      });
  }
}

export interface ProjectRuntimeTurnPlanInput {
  readonly turnId: string;
  readonly explanation: string | null;
  readonly plan: readonly JsonValue[];
}

export function projectRuntimeTurnPlan(input: ProjectRuntimeTurnPlanInput): ConversationWorkTraceItem {
  const itemId = `plan:${input.turnId}`;

  return projectSyntheticWorkTrace({
    itemId,
    codexType: 'plan',
    raw: {
      turnId: input.turnId,
      explanation: input.explanation,
      plan: input.plan,
    },
  });
}

export interface ProjectRuntimeTurnDiffInput {
  readonly turnId: string;
  readonly diff: string;
}

export function projectRuntimeTurnDiff(input: ProjectRuntimeTurnDiffInput): ConversationWorkTraceItem {
  const itemId = `diff:${input.turnId}`;

  return projectSyntheticWorkTrace({
    itemId,
    codexType: 'fileChange',
    raw: {
      turnId: input.turnId,
      diff: input.diff,
    },
  });
}

interface ProjectSyntheticWorkTraceInput {
  readonly itemId: string;
  readonly codexType: string;
  readonly raw: JsonObject;
}

function projectSyntheticWorkTrace(input: ProjectSyntheticWorkTraceInput): ConversationWorkTraceItem {
  return {
    id: input.itemId,
    kind: 'work-trace',
    codexType: input.codexType,
    fields: projectConversationItemFields({ raw: input.raw }),
  };
}
