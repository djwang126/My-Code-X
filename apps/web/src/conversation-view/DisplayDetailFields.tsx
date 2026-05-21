import type { DisplayDetail } from "@my-code-x/app-types";

interface DisplayDetailFieldsProps {
  detail: DisplayDetail;
}

export function DisplayDetailFields({ detail }: DisplayDetailFieldsProps) {
  if (detail.fields.length === 0) {
    return null;
  }

  return (
    <details className="display-detail">
      <summary>查看详情</summary>
      <dl className="display-detail-fields">
        {detail.fields.map((field) => (
          <div className="display-detail-field" key={field.key}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
