import { useEffect, useState } from "react";
import type { ConversationHostView } from "@my-code-x/app-types";
import { getCurrentConversation } from "./api-client";
import { ConversationHost } from "./conversation-view/ConversationHost";

type AppState =
  | { status: "loading" }
  | { status: "ready"; conversationHost: ConversationHostView }
  | { status: "failed"; message: string };

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    getCurrentConversation()
      .then((conversationHost) => {
        if (active) {
          setState({ status: "ready", conversationHost });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : "读取失败";
          setState({ status: "failed", message });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return <ConversationHost state={state} />;
}
