import { LiteralMessage } from '../lib/message-markdown';
import { formatStructuredValue } from '../lib/structured-format';

type LabeledLiteralFieldProps = {
  label: string;
  value: unknown;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
};

function isEmptyStructuredValue(value: unknown) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

export function LabeledLiteralField({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: LabeledLiteralFieldProps) {
  if (isEmptyStructuredValue(value)) {
    return null;
  }

  const formattedValue = formatStructuredValue(value);

  return (
    <div className={className}>
      <span className="visually-hidden">{label}: {formattedValue}</span>
      <div className={labelClassName}>{label}</div>
      <LiteralMessage className={valueClassName} text={formattedValue} />
    </div>
  );
}
