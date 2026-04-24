import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

interface InlineActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  primary?: boolean;
}

export function InlineActionButton({
  children,
  primary = false,
  className,
  ...props
}: InlineActionButtonProps) {
  return (
    <button
      {...props}
      className={joinClassNames('inline-action-card-action', primary && 'inline-action-card-action-primary', className)}
    >
      {children}
    </button>
  );
}

interface InlineActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  primary?: boolean;
}

export function InlineActionLink({
  children,
  primary = false,
  className,
  ...props
}: InlineActionLinkProps) {
  return (
    <a
      {...props}
      className={joinClassNames('inline-action-card-action', primary && 'inline-action-card-action-primary', className)}
    >
      {children}
    </a>
  );
}
