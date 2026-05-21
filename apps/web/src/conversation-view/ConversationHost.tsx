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
  const threadContext = topbarThreadContext(state);

  return (
    <main className="app-shell">
      <header className="conversation-topbar">
        <WorkspacePanelButton />
        <div className="thread-context">
          <span className="thread-title">{threadContext.title}</span>
          <span className="thread-cwd">{threadContext.cwd}</span>
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

  return (
    <div className="empty-state">
      <h1>Thread 已选中</h1>
      <p>当前 Thread 暂无已恢复的 Conversation timeline。</p>
    </div>
  );
}

function topbarThreadContext(state: ConversationHostState): {
  title: string;
  cwd: string;
} {
  if (
    state.status === "ready" &&
    state.conversationHost.kind === "conversationTargetSelected"
  ) {
    const thread = state.conversationHost.conversation.thread;
    return {
      title: thread.title ?? thread.threadId,
      cwd: thread.cwd ?? ""
    };
  }

  return {
    title: "No Thread",
    cwd: "未选择 Codex Thread"
  };
}
