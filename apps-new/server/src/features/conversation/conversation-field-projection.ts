import type { JsonObject } from '../../ports/index.js';
import type { ConversationItemField } from './conversation-events.js';

export interface ProjectConversationItemFieldsInput {
  readonly raw: JsonObject | undefined;
}

export function projectConversationItemFields(
  input: ProjectConversationItemFieldsInput,
): readonly ConversationItemField[] {
  const fields: ConversationItemField[] = [];

  if (input.raw) {
    for (const [name, value] of Object.entries(input.raw)) {
      fields.push({
        name,
        value,
      });
    }
  }

  return fields;
}
