import type { JsonValue } from '@my-code-x/contracts-new/json';
import type { RuntimeTurnEnvironment } from '../../../../ports/index.js';
import { cleanJsonObject } from './clean-json-object.js';

export function mapTurnEnvironments(environments: readonly RuntimeTurnEnvironment[] | null | undefined): readonly JsonValue[] | undefined {
  if (!environments?.length) {
    return undefined;
  }

  return environments.map(environment => cleanJsonObject({
    environmentId: environment.environmentId,
    cwd: environment.cwd,
  }));
}
