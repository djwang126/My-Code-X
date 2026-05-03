import type { JsonObject } from '@my-code-x/contracts-new/json';

const noOpNotificationMethods = new Set([
  'hook/started',
  'hook/completed',
  'item/autoApprovalReview/started',
  'item/autoApprovalReview/completed',
  'rawResponseItem/completed',
  'command/exec/outputDelta',
  'skills/changed',
  'mcpServer/oauthLogin/completed',
  'mcpServer/startupStatus/updated',
  'account/updated',
  'account/rateLimits/updated',
  'app/list/updated',
  'externalAgentConfig/import/completed',
  'fs/changed',
  'thread/compacted',
  'model/rerouted',
  'model/verification',
  'guardianWarning',
  'deprecationNotice',
  'configWarning',
  'fuzzyFileSearch/sessionUpdated',
  'fuzzyFileSearch/sessionCompleted',
  'windows/worldWritableWarning',
  'windowsSandbox/setupCompleted',
  'thread/realtime/started',
  'thread/realtime/itemAdded',
  'thread/realtime/transcript/delta',
  'thread/realtime/transcript/done',
  'thread/realtime/outputAudio/delta',
  'thread/realtime/sdp',
  'thread/realtime/closed',
  'account/login/completed',
]);

export function isNoOpNotification(method: string, _params: JsonObject): boolean {
  return noOpNotificationMethods.has(method);
}


