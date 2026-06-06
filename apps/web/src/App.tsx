import { useEffect, useState } from "react";
import {
  conversationStreamEventSchema
} from "@my-code-x/app-types";
import type { ConversationSnapshotView, TranscriptEntry } from "@my-code-x/app-types";
import {
  DEFAULT_CONVERSATION_VIEW_CLIENT
} from "./conversation-view-client";
import type { ConversationViewClient, EventSourceLike } from "./conversation-view-client";

export interface SelectedConversationView {
  id: string;
  title?: string;
  directory?: string;
}

export interface AppDependencies {
  selectedConversation?: SelectedConversationView | null;
  conversationViewClient?: ConversationViewClient;
}

function DisabledComposer() {
  return (
    <form className="composer" aria-label="Reply composer">
      <textarea aria-label="输入" placeholder="选择 Thread 后可以输入" disabled />
      <button type="button" aria-label="发送不可用" disabled>
        发送
      </button>
    </form>
  );
}

interface ComposerInput {
  draft: string;
  sending: boolean;
  onDraftChange(value: string): void;
  onSubmit(): void;
}

function Composer(input: ComposerInput) {
  return (
    <form
      className="composer"
      aria-label="Reply composer"
      onSubmit={(event) => {
        event.preventDefault();
        input.onSubmit();
      }}
    >
      <textarea
        aria-label="输入"
        placeholder="输入给 Codex 的指令"
        value={input.draft}
        onChange={(event) => {
          input.onDraftChange(event.target.value);
        }}
      />
      <button type="submit" aria-label="发送" disabled={input.sending}>
        发送
      </button>
    </form>
  );
}

function entryText(entry: TranscriptEntry): string {
  if (entry.body.kind === "UserInput") {
    return entry.body.markdown;
  }

  if (entry.body.kind === "AgentReply") {
    return entry.body.content;
  }

  return "";
}

export function App(input: AppDependencies = {}) {
  const selectedConversation = input.selectedConversation ?? null;
  const conversationViewClient =
    input.conversationViewClient ?? DEFAULT_CONVERSATION_VIEW_CLIENT;
  const [snapshot, setSnapshot] = useState<ConversationSnapshotView | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (selectedConversation === null) {
      setSnapshot(null);
      return;
    }

    setSnapshot(null);

    let active = true;
    let events: EventSourceLike | null = null;

    conversationViewClient.getSnapshot(selectedConversation.id).then((nextSnapshot) => {
      if (!active) {
        return;
      }

      setSnapshot(nextSnapshot);
      events = conversationViewClient.createEventSource({
        conversationId: selectedConversation.id,
        cursor: nextSnapshot.cursor
      });
      events.addEventListener("transcript.entry-added", (event) => {
        if (!active) {
          return;
        }

        let streamEvent;

        try {
          streamEvent = conversationStreamEventSchema.parse({
            id: event.lastEventId,
            type: "transcript.entry-added",
            data: JSON.parse(event.data) as unknown
          });
        } catch {
          return;
        }

        setSnapshot((previousSnapshot) => {
          if (
            previousSnapshot === null ||
            previousSnapshot.conversation.id !== selectedConversation.id
          ) {
            return previousSnapshot;
          }

          return {
            ...previousSnapshot,
            transcriptEntries: [
              ...previousSnapshot.transcriptEntries,
              streamEvent.data.entry
            ],
            cursor: streamEvent.id
          };
        });
      });
    });

    return () => {
      active = false;
      events?.close();
    };
  }, [conversationViewClient, selectedConversation]);

  if (selectedConversation === null) {
    return (
      <main className="app-shell">
        <section className="conversation-view" aria-label="Conversation View no thread selected">
          <header className="appbar">
            <h1>My-Code-X</h1>
          </header>
          <div className="state-view">
            <h2>打开一个 Codex Thread</h2>
          </div>
          <DisabledComposer />
        </section>
      </main>
    );
  }

  const currentSnapshot =
    snapshot?.conversation.id === selectedConversation.id ? snapshot : null;

  return (
    <main className="app-shell">
      <section className="conversation-view" aria-label="Conversation View">
        <header className="appbar">
          {selectedConversation.title !== undefined && <h1>{selectedConversation.title}</h1>}
          {selectedConversation.directory !== undefined && <p>{selectedConversation.directory}</p>}
        </header>
        {currentSnapshot !== null && (
          <ol className="conversation-transcript" aria-label="Conversation transcript">
            {currentSnapshot.transcriptEntries.map((entry) => (
              <li key={entry.id}>
                <article aria-label={entry.body.kind === "UserInput" ? "User message" : "Agent message"}>
                  <p>{entryText(entry)}</p>
                </article>
              </li>
            ))}
          </ol>
        )}
        <Composer
          draft={draft}
          sending={sending}
          onDraftChange={setDraft}
          onSubmit={() => {
            if (sending) {
              return;
            }

            setSending(true);
            void conversationViewClient
              .sendInput({
                conversationId: selectedConversation.id,
                markdownSource: draft
              })
              .then((outcome) => {
                if (outcome.outcome === "Accepted") {
                  setDraft("");
                }
              })
              .finally(() => {
                setSending(false);
              });
          }}
        />
      </section>
    </main>
  );
}
