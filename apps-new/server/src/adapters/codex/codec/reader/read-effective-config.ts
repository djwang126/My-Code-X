import type { JsonObject } from '@my-code-x/contracts-new/json';
import type { RuntimeThreadEffectiveConfig } from '../../../../ports/index.js';
import { readCodexJsonArray, readCodexTextLike } from '../../protocol/reader/index.js';
import { readString } from '../../protocol/reader/index.js';

export function hasCodexEffectiveConfig(payload: JsonObject): boolean {
  return [
    payload.model,
    payload.modelProvider,
    payload.serviceTier,
    payload.cwd,
    payload.approvalPolicy,
    payload.approvalsReviewer,
    payload.sandbox,
    payload.permissionProfile,
    payload.reasoningEffort,
  ].some(value => value !== undefined && value !== null) || readCodexJsonArray(payload.instructionSources, 'Codex thread result.instructionSources').length > 0;
}

export function readCodexEffectiveConfig(payload: JsonObject): RuntimeThreadEffectiveConfig {
  return {
    model: readCodexTextLike(payload.model),
    modelProvider: readCodexTextLike(payload.modelProvider),
    serviceTier: payload.serviceTier ?? null,
    cwd: readCodexTextLike(payload.cwd),
    instructionSources: readCodexJsonArray(payload.instructionSources, 'Codex thread result.instructionSources').map(item =>
      readString(item, 'Codex instruction source'),
    ),
    approvalPolicy: payload.approvalPolicy ?? null,
    approvalsReviewer: payload.approvalsReviewer ?? null,
    sandbox: payload.sandbox ?? null,
    permissionProfile: payload.permissionProfile ?? null,
    reasoningEffort: readCodexTextLike(payload.reasoningEffort),
  };
}


