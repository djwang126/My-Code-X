import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

interface PendingRequestActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  primary?: boolean;
}

export function PendingRequestActionButton({
  children,
  primary = false,
  className,
  ...props
}: PendingRequestActionButtonProps) {
  return (
    <button
      {...props}
      className={joinClassNames('pending-request-action', primary && 'pending-request-action-primary', className)}
    >
      {children}
    </button>
  );
}

interface PendingRequestActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  primary?: boolean;
}

export function PendingRequestActionLink({
  children,
  primary = false,
  className,
  ...props
}: PendingRequestActionLinkProps) {
  return (
    <a
      {...props}
      className={joinClassNames('pending-request-action', primary && 'pending-request-action-primary', className)}
    >
      {children}
    </a>
  );
}
