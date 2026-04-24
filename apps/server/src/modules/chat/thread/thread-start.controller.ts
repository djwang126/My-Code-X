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

export async function handleThreadStartRoute(request: any, response: any, { chatService }: any) {
  const body = await readJsonBodyOrSendError(request, response);
  if (!body) {
    return;
  }

  const viewerId = getTrimmedBodyString(body, 'viewerId');
  const slotId = getTrimmedBodyString(body, 'slotId');
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

  if (!workspace) {
    sendValidationError(response, 'workspace is required');
    return;
  }

  try {
    const result = await chatService.startThread({
      viewerId,
      slotId,
      workspace,
      runtimeSettings,
    });
    sendJson(response, 200, result);
  } catch (error) {
    sendRouteError(response, error);
  }
}
