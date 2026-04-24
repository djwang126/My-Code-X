import { useState, type FormEvent } from 'react';

import type { PendingRequestCardProps } from '../../types';
import { MarkdownMessage } from '../../lib/message-markdown';
import { PendingRequestActionButton } from './PendingRequestActions';
import { PendingRequestFrame } from './PendingRequestFrame';

function createUserInputAnswers({
  questions,
  selectedOptions,
  otherAnswers,
}: {
  questions: NonNullable<PendingRequestCardProps['request']['questions']>;
  selectedOptions: Record<string, string>;
  otherAnswers: Record<string, string>;
}) {
  return questions.reduce<Record<string, { answers: string[] }>>((nextAnswers, question) => {
    const rawOtherAnswer = otherAnswers[question.id] ?? '';
    const hasOtherAnswer = rawOtherAnswer.trim().length > 0;
    const selectedOption = selectedOptions[question.id];
    const answer = hasOtherAnswer ? rawOtherAnswer : selectedOption;

    if (answer) {
      nextAnswers[question.id] = {
        answers: [answer],
      };
    }

    return nextAnswers;
  }, {});
}

function isRequestStale({ request, latestTurn, currentThreadId = '' }: PendingRequestCardProps) {
  const activeChatTurnId = latestTurn?.id ?? '';

  return Boolean(
    request.threadId &&
      currentThreadId &&
      request.threadId === currentThreadId &&
      request.turnId &&
      activeChatTurnId &&
      request.turnId !== activeChatTurnId,
  );
}

export function UserInputRequestCard(props: PendingRequestCardProps) {
  const { request, onRequestResponse, latestTurn, currentThreadId = '' } = props;
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});
  const stale = isRequestStale({ request, latestTurn, currentThreadId });
  const submitting = request.submitState === 'submitting' || stale;
  const questions = request.questions ?? [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stale) {
      return;
    }

    await onRequestResponse?.(request.id, {
      answers: createUserInputAnswers({
        questions,
        selectedOptions,
        otherAnswers,
      }),
    });
  }

  return (
    <PendingRequestFrame request={request} stale={stale}>
      <form className="pending-request-form" onSubmit={handleSubmit}>
        {questions.map(question => (
          <fieldset className="pending-request-question" key={question.id}>
            <legend>{question.header}</legend>
            <MarkdownMessage className="markdown-content-compact pending-request-question-copy" text={question.question} />
            {question.options?.length ? (
              <div className="pending-request-option-list">
                {question.options.map(option => (
                  <label
                    className={`pending-request-option ${selectedOptions[question.id] === option.label ? 'is-selected' : ''}`}
                    key={`${question.id}-${option.label}`}
                  >
                    <input
                      aria-label={option.label}
                      checked={selectedOptions[question.id] === option.label}
                      disabled={submitting}
                      name={question.id}
                      onChange={() => {
                        setSelectedOptions(current => ({ ...current, [question.id]: option.label }));
                        setOtherAnswers(current => ({ ...current, [question.id]: '' }));
                      }}
                      type="radio"
                    />
                    <div className="pending-request-option-copy">
                      <span className="pending-request-option-label">{option.label}</span>
                      {option.description ? (
                        <MarkdownMessage
                          className="markdown-content-compact pending-request-option-description"
                          text={option.description}
                        />
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            ) : null}
            {question.isOther || !question.options?.length ? (
              <label className="pending-request-input-group">
                <input
                  aria-label={question.header}
                  disabled={submitting}
                  onChange={event => {
                    const nextValue = event.target.value;
                    setOtherAnswers(current => ({ ...current, [question.id]: nextValue }));

                    if (nextValue.trim()) {
                      setSelectedOptions(current => ({ ...current, [question.id]: '' }));
                    }
                  }}
                  placeholder={question.options?.length ? 'Other' : undefined}
                  type={question.isSecret ? 'password' : 'text'}
                  value={otherAnswers[question.id] ?? ''}
                />
              </label>
            ) : null}
          </fieldset>
        ))}
        <div className="pending-request-actions">
          <PendingRequestActionButton disabled={submitting} primary type="submit">
            Submit input
          </PendingRequestActionButton>
        </div>
      </form>
    </PendingRequestFrame>
  );
}
