import type { DisplayDetail } from "@my-code-x/app-types";

interface DisplayDetailFieldsProps {
  detail: DisplayDetail;
}

export function DisplayDetailFields({ detail }: DisplayDetailFieldsProps) {
  if (detail.fields.length === 0) {
    return null;
  }

  return (
    <dl className="field-list">
      {detail.fields.map((field) => (
        <div className="field-row" key={field.key}>
          <dt className="field-name">{field.label}</dt>
          <dd className="field-value">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
