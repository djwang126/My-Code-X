import { afterEach, describe, expect, test, vi } from "vitest";
import { copyTextToClipboard } from "./copy-to-clipboard";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("copies text when the browser clipboard is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText
      }
    });

    await expect(copyTextToClipboard("code block")).resolves.toEqual({
      kind: "copied"
    });
    expect(writeText).toHaveBeenCalledWith("code block");
  });

  test("reports unavailable when the browser clipboard is missing", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyTextToClipboard("message")).resolves.toEqual({
      kind: "unavailable"
    });
  });

  test("reports failure when the browser rejects the copy request", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("permission denied"));
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText
      }
    });

    await expect(copyTextToClipboard("message")).resolves.toEqual({
      kind: "failed",
      message: "permission denied"
    });
  });
});
