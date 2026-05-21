import { type ReactNode, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./CopyButton";

export interface MarkdownMessageProps {
  text: string;
}

export function MarkdownMessage({ text }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      components={{
        h1: PlainBlock,
        h2: PlainBlock,
        h3: PlainBlock,
        h4: PlainBlock,
        h5: PlainBlock,
        h6: PlainBlock,
        blockquote({ children }) {
          return <>{children}</>;
        },
        img({ alt }) {
          return <span>{alt ? `[image: ${alt}]` : "[image]"}</span>;
        },
        pre({ children }) {
          return <CodeBlock>{children}</CodeBlock>;
        },
        table({ children }) {
          return <MarkdownTable>{children}</MarkdownTable>;
        },
        a({ children, href }) {
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        }
      }}
      remarkPlugins={[remarkGfm]}
    >
      {text}
    </ReactMarkdown>
  );
}

function PlainBlock({ children }: { children?: ReactNode }) {
  return <p>{children}</p>;
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const copyText = codeBlockText(children);

  return (
    <div className="code-block-wrap">
      <CopyButton
        className="code-block-copy"
        ariaLabel="复制代码块"
        copyText={copyText}
      />
      <pre className="code-block">{children}</pre>
    </div>
  );
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Markdown table scroll area"
    >
      <table className="markdown-table">{children}</table>
    </div>
  );
}

function codeBlockText(children: ReactNode): string {
  const text = textFromReactNode(children);
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

function textFromReactNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromReactNode).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromReactNode(node.props.children);
  }

  return "";
}
