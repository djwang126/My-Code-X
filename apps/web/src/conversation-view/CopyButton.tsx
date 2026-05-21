import { Copy } from "lucide-react";
import { copyTextToClipboard } from "./copy-to-clipboard";

export interface CopyButtonProps {
  ariaLabel: string;
  className: string;
  copyText: string;
}

export function CopyButton({
  ariaLabel,
  className,
  copyText
}: CopyButtonProps) {
  return (
    <button
      className={`copy-button ${className}`}
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        void copyTextToClipboard(copyText);
      }}
    >
      <Copy size={15} aria-hidden="true" />
    </button>
  );
}
