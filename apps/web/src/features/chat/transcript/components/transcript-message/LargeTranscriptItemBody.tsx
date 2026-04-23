import { useEffect, useRef, useState } from 'react';

import type { SessionTimelineSpecialItem } from '../../../runtime/public-types';
import type { TimelineItemContentPayload } from '../../../runtime/public-types';
import type { TranscriptTimelineItemContentHandler } from '../../types';
import { LabeledLiteralField } from '../LabeledLiteralField';

type LargeTranscriptItemMessage = SessionTimelineSpecialItem & {
  itemType: 'commandExecution' | 'fileChange';
};

type DetailLoadState =
  | { status: 'idle'; revision: string }
  | { status: 'loading'; revision: string }
  | { status: 'loaded'; revision: string; payload: TimelineItemContentPayload }
  | { status: 'error'; revision: string; message: string };

type LargeTranscriptItemBodyProps = {
  message: LargeTranscriptItemMessage;
  onTimelineItemContentLoad?: TranscriptTimelineItemContentHandler;
};

function readDetailRevision(message: LargeTranscriptItemMessage) {
  return typeof message.raw?.detailRevision === 'string' && message.raw.detailRevision
    ? message.raw.detailRevision
    : message.id;
}

function renderLiteralField(label: string, value: unknown, key: string) {
  return (
    <LabeledLiteralField
      className="timeline-card-field"
      key={key}
      label={label}
      labelClassName="timeline-card-field-label"
      value={value}
      valueClassName="literal-content-compact timeline-card-field-value"
    />
  );
}

function renderChangedFiles(changes: unknown) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return null;
  }

  return changes
    .map(change => {
      if (change && typeof change === 'object' && 'path' in change) {
        return `- ${String(change.path)}`;
      }

      return `- ${String(change)}`;
    })
    .join('\n');
}

function renderLargeTranscriptItemMetadata(message: LargeTranscriptItemMessage, payload: TimelineItemContentPayload) {
  const raw = payload.raw ?? {};

  if (message.itemType === 'commandExecution') {
    return (
      <>
        {renderLiteralField('Command', raw.command, `${message.id}-command`)}
        {renderLiteralField('Cwd', raw.cwd, `${message.id}-cwd`)}
        {renderLiteralField('Output', raw.aggregatedOutput, `${message.id}-output`)}
        {renderLiteralField('Exit code', raw.exitCode, `${message.id}-exit-code`)}
        {renderLiteralField(
          'Duration',
          typeof raw.durationMs === 'number' ? `${raw.durationMs} ms` : raw.durationMs,
          `${message.id}-duration`,
        )}
      </>
    );
  }

  return (
    <>
      {renderLiteralField('Changed files', renderChangedFiles(raw.changes), `${message.id}-changes`)}
      {renderLiteralField('Output', raw.output, `${message.id}-output`)}
    </>
  );
}

export function LargeTranscriptItemBody({
  message,
  onTimelineItemContentLoad,
}: LargeTranscriptItemBodyProps) {
  const requestIdRef = useRef(0);
  const revision = readDetailRevision(message);
  const [detailState, setDetailState] = useState<DetailLoadState>({ status: 'idle', revision });

  useEffect(() => {
    requestIdRef.current += 1;
    setDetailState({ status: 'idle', revision });
  }, [message.id, revision]);

  useEffect(() => {
    if (!onTimelineItemContentLoad || detailState.revision !== revision || detailState.status !== 'idle') {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setDetailState({ status: 'loading', revision });

    void Promise.resolve(onTimelineItemContentLoad(message.id))
      .then(payload => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setDetailState({ status: 'loaded', revision, payload });
      })
      .catch(error => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setDetailState({
          status: 'error',
          revision,
          message: error instanceof Error ? error.message : String(error),
        });
      });
  }, [detailState.revision, detailState.status, message.id, onTimelineItemContentLoad, revision]);

  if (!onTimelineItemContentLoad) {
    return <div className="timeline-card-field-hint">Details unavailable.</div>;
  }

  if (detailState.status === 'loading' || detailState.status === 'idle') {
    return <div className="timeline-card-field-hint">Loading details…</div>;
  }

  if (detailState.status === 'error') {
    return (
      <>
        <button
          aria-label="Reload details"
          className="timeline-card-expand-btn"
          onClick={() => setDetailState({ status: 'idle', revision })}
          type="button"
        >
          重新加载
        </button>
        <div className="timeline-card-field-hint">{detailState.message}</div>
      </>
    );
  }

  return renderLargeTranscriptItemMetadata(message, detailState.payload);
}
