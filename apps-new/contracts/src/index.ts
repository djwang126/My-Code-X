import { z } from 'zod';

export {
  clientConversationErrorSchema,
  clientConversationItemSchema,
  clientConversationViewSchema,
  type ClientConversationError,
  type ClientConversationItem,
  type ClientConversationMessageItem,
  type ClientConversationView,
} from './conversation-view.js';

export const contractVersionSchema = z.literal(1);

export type ContractVersion = z.infer<typeof contractVersionSchema>;

export const contractVersion: ContractVersion = 1;
