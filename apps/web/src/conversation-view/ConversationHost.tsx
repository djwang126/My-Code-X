import { PanelLeft } from "lucide-react";
import type { ConversationHostView } from "@my-code-x/app-types";
import { WorkspacePanelButton } from "../workspaces/WorkspacePanelButton";

type ConversationHostState =
  | { status: "loading" }
  | { status: "ready"; conversationHost: ConversationHostView }
  | { status: "failed"; message: string };

export interface ConversationHostProps {
  state: ConversationHostState;
}

export function ConversationHost({ state }: ConversationHostProps) {
  return (
    <main className="app-shell">
      <header className="conversation-topbar">
        <WorkspacePanelButton />
        <div className="thread-context">
          <span className="thread-title">No Thread</span>
          <span className="thread-cwd">未选择 Codex Thread</span>
        </div>
        <button className="icon-button" type="button" aria-label="Open context panel">
          <PanelLeft size={20} aria-hidden="true" />
        </button>
      </header>

      <section className="conversation-body">
        {state.status === "loading" ? <LoadingConversation /> : null}
        {state.status === "failed" ? (
          <FailedConversation message={state.message} />
        ) : null}
        {state.status === "ready" ? (
          <ReadyConversation conversationHost={state.conversationHost} />
        ) : null}
      </section>

      <footer className="composer-shell">
        <textarea
          className="composer-input"
          value=""
          placeholder="选择 Thread 后继续输入"
          disabled
          aria-label="Composer"
        />
        <button className="composer-action" type="button" disabled>
          Send
        </button>
      </footer>
    </main>
  );
}

function LoadingConversation() {
  return (
    <div className="empty-state" role="status">
      <h1>正在读取</h1>
      <p>Conversation View 正在连接本机 My-Code-X server。</p>
    </div>
  );
}

function FailedConversation({ message }: { message: string }) {
  return (
    <div className="empty-state empty-state-error" role="alert">
      <h1>读取失败</h1>
      <p>{message}</p>
    </div>
  );
}

function ReadyConversation(input: { conversationHost: ConversationHostView }) {
  if (input.conversationHost.kind === "noConversationTarget") {
    return (
      <div className="empty-state">
        <h1>没有选中的 Thread</h1>
        <p>从 Workspace panel 选择一个 Codex Thread 后，这里会显示当前工作现场。</p>
      </div>
    );
  }
}
