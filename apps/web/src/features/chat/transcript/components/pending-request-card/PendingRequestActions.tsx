import { InlineActionButton, InlineActionLink } from '../inline-action-card/InlineActionButton';
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
    <InlineActionButton
      {...props}
      className={joinClassNames('pending-request-action', primary && 'pending-request-action-primary', className)}
      primary={primary}
    >
      {children}
    </InlineActionButton>
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
    <InlineActionLink
      {...props}
      className={joinClassNames('pending-request-action', primary && 'pending-request-action-primary', className)}
      primary={primary}
    >
      {children}
    </InlineActionLink>
  );
}
