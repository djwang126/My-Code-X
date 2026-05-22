import type { DisplayDetail, TimelineItem } from "@my-code-x/app-types";

export interface PayloadDisplayDetailInput {
  payload: object;
  excludedKeys: readonly string[];
}

export function payloadDisplayDetail(
  input: PayloadDisplayDetailInput
): DisplayDetail {
  const fields = Object.entries(input.payload)
    .filter(([key]) => !input.excludedKeys.includes(key))
    .map(([key, value]) => {
      const text = displayValue(value);

      return {
        key,
        label: key,
        value: text,
        copyText: text
      };
    });

  return { fields };
}

export function timelineStatusFromCodexStatus(
  status: unknown
): TimelineItem["status"] {
  if (
    status === "inProgress" ||
    status === "completed" ||
    status === "failed" ||
    status === "declined"
  ) {
    return status;
  }

  return "unknown";
}

function displayValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  try {
    const json = JSON.stringify(value);
    if (typeof json === "string") {
      return json;
    }
  } catch {
    return "[unserializable]";
  }

  return String(value);
}
