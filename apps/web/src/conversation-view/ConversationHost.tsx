import {
  AlertTriangle,
  List,
  LoaderCircle,
  MessageSquare,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import type {
  ComposerDisabledReason,
  ConversationHostView,
  TimelineItem
} from "@my-code-x/app-types";
import { WorkspacePanelButton } from "../workspaces/WorkspacePanelButton";
import sendButtonIconUrl from "./assets/send-button-icon.png";

type ConversationHostState =
  | { status: "loading" }
  | { status: "ready"; conversationHost: ConversationHostView }
  | { status: "failed"; message: string };

export interface ConversationHostProps {
  state: ConversationHostState;
}

export function ConversationHost({ state }: ConversationHostProps) {
  const threadContext = topbarThreadContext(state);
  const composer = composerView(state);

  return (
    <main className="app-shell" aria-label="Conversation View">
      <header className="conversation-topbar">
        <WorkspacePanelButton />
        <div className="thread-context">
          <span className="thread-title">{threadContext.title}</span>
          <span className="thread-cwd">{threadContext.cwd}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Open context panel">
          <MoreVertical size={20} aria-hidden="true" />
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

      <footer className="composer-shell" aria-label="Reply composer">
        <div className="composer-box">
          <textarea
            className="composer-input"
            defaultValue={composer.draft}
            placeholder={composer.placeholder}
            disabled={composer.disabled}
            readOnly
            aria-label="输入"
          />
          <button
            className={`send-button ${composer.buttonClassName}`}
            type="button"
            disabled={composer.disabled || composer.buttonKind === "disabled"}
            aria-label={composer.buttonLabel}
          >
            {composer.buttonKind === "stop" ? (
              <StopIcon />
            ) : (
              <img className="send-icon" src={sendButtonIconUrl} alt="" aria-hidden="true" />
            )}
          </button>
        </div>
      </footer>
    </main>
  );
}

function LoadingConversation() {
  return (
    <div className="empty-state" role="status">
      <div className="state-icon">
        <LoaderCircle size={22} aria-hidden="true" />
      </div>
      <h1>正在恢复内容</h1>
    </div>
  );
}

function FailedConversation({ message }: { message: string }) {
  return (
    <div className="empty-state empty-state-error" role="alert">
      <div className="state-icon state-icon-error">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <h1>内容读取失败</h1>
      <p>{message}</p>
    </div>
  );
}

function ReadyConversation(input: { conversationHost: ConversationHostView }) {
  if (input.conversationHost.kind === "noConversationTarget") {
    return (
      <div className="empty-state">
        <div className="state-icon state-icon-quiet">
          <MessageSquare size={22} aria-hidden="true" />
        </div>
        <h1>打开一个 Codex Thread</h1>
      </div>
    );
  }

  const conversation = input.conversationHost.conversation;

  if (conversation.timeline.length > 0) {
    return <ConversationTimeline items={conversation.timeline} />;
  }

  if (conversation.pageState.kind === "restoring") {
    return <RestoringConversation />;
  }

  if (conversation.pageState.kind === "restoreFailed") {
    return <FailedConversation message={conversation.pageState.message} />;
  }

  if (conversation.pageState.kind === "stale") {
    return <StaleConversation message={conversation.pageState.message} />;
  }

  return <EmptyConversation />;
}

interface ConversationTimelineProps {
  items: TimelineItem[];
}

function ConversationTimeline({ items }: ConversationTimelineProps) {
  return (
    <div className="conversation-timeline" aria-label="Timeline">
      <ol className="timeline-list">
        {items.map((item) => (
          <TimelineEntry item={item} key={item.id} />
        ))}
      </ol>
    </div>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  if (item.kind === "message") {
    return <MessageTimelineEntry item={item} />;
  }

  return null;
}

function MessageTimelineEntry({
  item
}: {
  item: Extract<TimelineItem, { kind: "message" }>;
}) {
  const isUserMessage = item.message.role === "user";
  const rowClassName = isUserMessage
    ? "transcript-row message-row user-message-row"
    : "transcript-row message-row";
  const textClassName = isUserMessage
    ? "message-text message-text--user"
    : "message-text";
  const roleLabel = isUserMessage ? "用户消息" : "Codex 消息";

  return (
    <li className={rowClassName}>
      <article aria-label={roleLabel}>
        <div className={textClassName}>
          <p>{item.message.text}</p>
        </div>
      </article>
    </li>
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

interface ComposerPresentation {
  buttonClassName: string;
  buttonKind: "disabled" | "send" | "stop";
  buttonLabel: string;
  disabled: boolean;
  draft: string;
  placeholder: string;
}

function composerView(state: ConversationHostState): ComposerPresentation {
  if (state.status === "loading") {
    return disabledComposerView("内容恢复后可以输入");
  }

  if (state.status === "failed") {
    return disabledComposerView("恢复后可以输入");
  }

  if (
    state.conversationHost.kind === "noConversationTarget"
  ) {
    return disabledComposerView("选择 Thread 后可以输入");
  }

  const conversation = state.conversationHost.conversation;
  const action = conversation.composer.action;

  if (action.kind === "interrupt") {
    return {
      buttonClassName: "send-button--stop",
      buttonKind: "stop",
      buttonLabel: "中断当前 Turn",
      disabled: false,
      draft: conversation.composer.draft,
      placeholder: "发送指令"
    };
  }

  if (action.kind === "send" || action.kind === "steer") {
    return {
      buttonClassName: "",
      buttonKind: "send",
      buttonLabel: action.kind === "send" ? "发送" : "追加输入",
      disabled: false,
      draft: conversation.composer.draft,
      placeholder: "输入给 Codex 的指令"
    };
  }

  return disabledComposerActionView({
    draft: conversation.composer.draft,
    reason: action.reason
  });
}

function disabledComposerView(placeholder: string): ComposerPresentation {
  return {
    buttonClassName: "send-button--disabled",
    buttonKind: "disabled",
    buttonLabel: "发送不可用",
    disabled: true,
    draft: "",
    placeholder
  };
}

function disabledComposerActionView(input: {
  draft: string;
  reason: ComposerDisabledReason;
}): ComposerPresentation {
  const lockInput = input.reason !== "emptyDraft";

  return {
    buttonClassName: "send-button--disabled",
    buttonKind: "disabled",
    buttonLabel: "发送不可用",
    disabled: lockInput,
    draft: input.draft,
    placeholder: disabledComposerPlaceholder(input.reason)
  };
}

function disabledComposerPlaceholder(reason: ComposerDisabledReason): string {
  if (reason === "restoring") {
    return "内容恢复后可以输入";
  }

  if (reason === "connectionUnavailable") {
    return "连接恢复后可以输入";
  }

  if (reason === "unreliableThreadTarget") {
    return "当前 Thread 不可靠";
  }

  if (reason === "unreliableTurnTarget") {
    return "当前 Turn 不可靠";
  }

  if (reason === "systemError") {
    return "恢复后可以输入";
  }

  if (reason === "unknown") {
    return "状态未知，暂不可输入";
  }

  return "输入给 Codex 的指令";
}

function RestoringConversation() {
  return (
    <div className="empty-state" role="status">
      <div className="state-icon">
        <RefreshCw size={22} aria-hidden="true" />
      </div>
      <h1>正在恢复内容</h1>
    </div>
  );
}

function StaleConversation({ message }: { message: string }) {
  return (
    <div className="empty-state" role="status">
      <div className="state-icon">
        <RefreshCw size={22} aria-hidden="true" />
      </div>
      <h1>内容可能不是最新</h1>
      <p>{message}</p>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="empty-state">
      <div className="state-icon state-icon-quiet">
        <List size={22} aria-hidden="true" />
      </div>
      <h1>暂无可展示内容</h1>
    </div>
  );
}

function StopIcon() {
  return (
    <svg className="stop-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
      <rect className="stop-icon-fill" x="9" y="9" width="6" height="6" rx="0.8" />
    </svg>
  );
}
