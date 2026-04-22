export function parseEventData(data: string | null | undefined): unknown {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

