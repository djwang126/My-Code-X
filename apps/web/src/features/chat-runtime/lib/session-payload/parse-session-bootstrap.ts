import type { SessionPayload } from '../../session-types';
import { readRequiredBoolean, readRequiredRecord, readRequiredString } from './readers';
import {
  readSessionNoticeArray,
  readSessionPendingRequestArray,
  readSessionRecord,
} from './shared';
import { readSessionTimelineItems } from './timeline';

export function parseSessionPayload(value: unknown): SessionPayload {
  const record = readRequiredRecord(value, 'session payload');
  const server = readRequiredRecord(record.server, 'session payload.server');
  const viewer = readRequiredRecord(record.viewer, 'session payload.viewer');
  const conversation = readRequiredRecord(record.conversation, 'session payload.conversation');
  const stream = readRequiredRecord(record.stream, 'session payload.stream');

  return {
    server: {
      ok: readRequiredBoolean(server.ok, 'session payload.server.ok'),
      serverInstanceId: readRequiredString(server.serverInstanceId, 'session payload.server.serverInstanceId'),
      authRequired: readRequiredBoolean(server.authRequired, 'session payload.server.authRequired'),
    },
    viewer: {
      viewerId: readRequiredString(viewer.viewerId, 'session payload.viewer.viewerId'),
      slotId: readRequiredString(viewer.slotId, 'session payload.viewer.slotId'),
    },
    session: readSessionRecord(record.session, 'session payload.session'),
    conversation: {
      messages: readSessionTimelineItems(conversation.messages, 'session payload.conversation.messages'),
    },
    stream: {
      url: readRequiredString(stream.url, 'session payload.stream.url'),
    },
    preferences: readRequiredRecord(record.preferences, 'session payload.preferences'),
    options: readRequiredRecord(record.options, 'session payload.options'),
    notices: readSessionNoticeArray(record.notices, 'session payload.notices'),
    pendingRequests: readSessionPendingRequestArray(record.pendingRequests, 'session payload.pendingRequests'),
  };
}
