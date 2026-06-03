import type { ConversationHostView } from "@my-code-x/app-types";

export function getCurrentConversation(): ConversationHostView {
  return {
    kind: "noConversationTarget"
  };
}
