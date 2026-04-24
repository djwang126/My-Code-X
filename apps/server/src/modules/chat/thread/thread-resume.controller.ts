import {
  getTrimmedBodyString,
  readJsonBodyOrSendError,
  sendJson,
  sendRouteError,
  sendValidationError,
} from '../../../common/http/route-helpers.js';

function readOptionalRuntimeSettings(body: any) {
  return body?.runtimeSettings && typeof body.runtimeSettings === 'object' && !Array.isArray(body.runtimeSettings)
    ? body.runtimeSettings
    : undefined;
}

export async function handleThreadResumeRoute(request: any, response: any, { chatService }: any) {
  const body = await readJsonBodyOrSendError(request, response);
  if (!body) {
    return;
  }

  const viewerId = getTrimmedBodyString(body, 'viewerId');
  const slotId = getTrimmedBodyString(body, 'slotId');
  const threadId = getTrimmedBodyString(body, 'threadId');
  const workspace = getTrimmedBodyString(body, 'workspace');
  const runtimeSettings = readOptionalRuntimeSettings(body);

  if (!viewerId) {
    sendValidationError(response, 'viewerId is required');
    return;
  }

  if (!slotId) {
    sendValidationError(response, 'slotId is required');
    return;
  }

  if (!threadId) {
    sendValidationError(response, 'threadId is required');
    return;
  }

  try {
    const result = await chatService.resumeThread({
      viewerId,
      slotId,
      threadId,
      workspace,
      runtimeSettings,
    });
    sendJson(response, 200, result);
  } catch (error) {
    sendRouteError(response, error);
  }
}
