import { useState } from 'react';
import type { ClientConversationItemField } from '@my-code-x/contracts-new';
import {
  createConversationFieldKey,
  createConversationFieldValueView,
  expandConversationField,
} from '../model/index.js';

export interface ConversationFieldCardProps {
  readonly ariaLabel: string;
  readonly cardClassName: string;
  readonly codexType: string;
  readonly fields: readonly ClientConversationItemField[];
  readonly itemId: string;
}

export function ConversationFieldCard(input: ConversationFieldCardProps) {
  return (
    <details aria-label={input.ariaLabel} className={input.cardClassName}>
      <summary>{input.codexType}</summary>
      <ConversationFieldList fields={input.fields} itemId={input.itemId} />
    </details>
  );
}

interface ConversationFieldListProps {
  readonly fields: readonly ClientConversationItemField[];
  readonly itemId: string;
}

function ConversationFieldList(input: ConversationFieldListProps) {
  const [expandedFields, setExpandedFields] = useState<ReadonlySet<string>>(() => new Set());

  function expandField(fieldKey: string): void {
    setExpandedFields(current => expandConversationField({
      expandedFields: current,
      fieldKey,
    }));
  }

  return (
    <dl className="conversation-view__field-list">
      {input.fields.map((field, index) => {
        const fieldKey = createConversationFieldKey({
          itemId: input.itemId,
          fieldName: field.name,
          index,
        });

        return (
          <ConversationFieldRow
            expanded={expandedFields.has(fieldKey)}
            field={field}
            fieldKey={fieldKey}
            key={fieldKey}
            onExpand={expandField}
          />
        );
      })}
    </dl>
  );
}

interface ConversationFieldRowProps {
  readonly expanded: boolean;
  readonly field: ClientConversationItemField;
  readonly fieldKey: string;
  onExpand(fieldKey: string): void;
}

function ConversationFieldRow(input: ConversationFieldRowProps) {
  const valueView = createConversationFieldValueView({
    value: input.field.value,
    expanded: input.expanded,
  });

  return (
    <div className="conversation-view__field-row">
      <dt className="conversation-view__field-name">{input.field.name}</dt>
      <dd className="conversation-view__field-value">
        <pre>{valueView.text}</pre>
        {valueView.truncated ? (
          <button
            className="conversation-view__expand-field"
            onClick={() => {
              input.onExpand(input.fieldKey);
            }}
            type="button"
          >
            展开剩余 {valueView.remainingLineCount} 行
          </button>
        ) : null}
      </dd>
    </div>
  );
}
