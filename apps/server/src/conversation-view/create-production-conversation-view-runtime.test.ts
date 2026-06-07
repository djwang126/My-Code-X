import { describe, expect, it } from "vitest";
import {
  ConversationRuntimeConfigurationError,
  createProductionConversationViewRuntime
} from "./create-production-conversation-view-runtime";

describe("createProductionConversationViewRuntime", () => {
  it("fails fast when conversation runtime configuration is missing", () => {
    expect(() => createProductionConversationViewRuntime()).toThrow(
      ConversationRuntimeConfigurationError
    );
  });
});
