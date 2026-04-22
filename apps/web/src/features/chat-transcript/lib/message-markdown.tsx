import { type ReactNode, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownMessageProps = {
  text: string;
  className?: string;
  onFileHrefOpen?: (href: string) => void;
  isWorkspaceFileLink?: (href: string) => boolean;
};

type LiteralMessageProps = {
  text: string;
  className?: string;
};

type CollapsibleMarkdownLinkProps = {
  href?: string;
  children: ReactNode;
  onFileHrefOpen?: (href: string) => void;
  isWorkspaceFileLink?: (href: string) => boolean;
};

function isWebHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function CollapsibleMarkdownLink({ href = '', children, onFileHrefOpen, isWorkspaceFileLink }: CollapsibleMarkdownLinkProps) {
  const [expanded, setExpanded] = useState(false);
  const isResolvedWorkspaceFileLink = Boolean(onFileHrefOpen && isWorkspaceFileLink?.(href));

  return (
    <>
      <button
        type="button"
        className="markdown-collapsible-link"
        aria-expanded={expanded}
        onClick={() => setExpanded(open => !open)}
      >
        [{children}]
      </button>
      {expanded ? (
        <span className="markdown-link-target">
          {isWebHref(href) ? (
            <a href={href} rel="noreferrer noopener" target="_blank">
              ({href})
            </a>
          ) : isResolvedWorkspaceFileLink ? (
            <button className="markdown-link-target-button" onClick={() => onFileHrefOpen?.(href)} type="button">
              ({href})
            </button>
          ) : (
            <span>({href})</span>
          )}
        </span>
      ) : null}
    </>
  );
}

export function MarkdownMessage({ text, className, onFileHrefOpen, isWorkspaceFileLink }: MarkdownMessageProps) {
  return (
    <div className={className ? `markdown-content ${className}` : 'markdown-content'}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <CollapsibleMarkdownLink
              href={href}
              isWorkspaceFileLink={isWorkspaceFileLink}
              onFileHrefOpen={onFileHrefOpen}
            >
              {children}
            </CollapsibleMarkdownLink>
          ),
          pre: props => <pre {...props} className="markdown-code-block" />,
          table: props => (
            <div className="markdown-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
        remarkPlugins={[remarkGfm]}
        urlTransform={url => url}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function LiteralMessage({ text, className }: LiteralMessageProps) {
  return <div className={className ? `literal-content ${className}` : 'literal-content'}>{text}</div>;
}
