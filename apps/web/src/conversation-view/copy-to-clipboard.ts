export type CopyTextResult =
  | { kind: "copied" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string };

interface ClipboardWriter {
  writeText(text: string): Promise<void>;
}

export async function copyTextToClipboard(
  text: string
): Promise<CopyTextResult> {
  const clipboard = currentClipboardWriter();
  if (!clipboard) {
    return { kind: "unavailable" };
  }

  try {
    await clipboard.writeText(text);
    return { kind: "copied" };
  } catch (error) {
    return {
      kind: "failed",
      message: errorMessage(error)
    };
  }
}

function currentClipboardWriter(): ClipboardWriter | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const clipboard = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    return null;
  }

  return clipboard;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Clipboard write failed";
}
