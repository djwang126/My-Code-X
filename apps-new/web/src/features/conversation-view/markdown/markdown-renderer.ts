export interface RenderConversationMarkdownInput {
  readonly text: string;
}

export interface RenderedCodeBlock {
  readonly kind: 'code';
  readonly id: string;
  readonly html: string;
  readonly text: string;
}

export interface RenderedHtmlBlock {
  readonly kind: 'html';
  readonly id: string;
  readonly html: string;
}

export type RenderedMarkdownBlock = RenderedCodeBlock | RenderedHtmlBlock;

export interface RenderConversationMarkdownResult {
  readonly blocks: readonly RenderedMarkdownBlock[];
}

interface RenderBlockResult {
  readonly block: RenderedMarkdownBlock;
  readonly nextLineIndex: number;
}

export function renderConversationMarkdown(input: RenderConversationMarkdownInput): RenderConversationMarkdownResult {
  const lines = input.text.split('\n');
  const blocks: RenderedMarkdownBlock[] = [];
  let codeBlockCount = 0;
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    if (lines[lineIndex] === '') {
      lineIndex += 1;
      continue;
    }

    const result = renderBlock({
      lines,
      lineIndex,
      blockNumber: blocks.length + 1,
      codeBlockNumber: codeBlockCount + 1,
    });

    blocks.push(result.block);
    if (result.block.kind === 'code') {
      codeBlockCount += 1;
    }
    lineIndex = result.nextLineIndex;
  }

  return {
    blocks,
  };
}

interface RenderBlockInput {
  readonly lines: readonly string[];
  readonly lineIndex: number;
  readonly blockNumber: number;
  readonly codeBlockNumber: number;
}

function renderBlock(input: RenderBlockInput): RenderBlockResult {
  const line = input.lines[input.lineIndex] ?? '';

  if (line.startsWith('```')) {
    return renderCodeBlock(input);
  }

  if (isTableStart({ lines: input.lines, lineIndex: input.lineIndex })) {
    return renderTable(input);
  }

  if (line.startsWith('- ')) {
    return renderList(input);
  }

  return renderParagraph(input);
}

function renderCodeBlock(input: RenderBlockInput): RenderBlockResult {
  const codeLines: string[] = [];
  let lineIndex = input.lineIndex + 1;

  while (lineIndex < input.lines.length) {
    const line = input.lines[lineIndex] ?? '';

    if (line.startsWith('```')) {
      lineIndex += 1;
      break;
    }

    codeLines.push(line);
    lineIndex += 1;
  }

  const text = codeLines.join('\n');
  const id = `code-${input.codeBlockNumber}`;

  return {
    block: {
      kind: 'code',
      id,
      html: `<pre><code>${escapeHtml(text)}</code></pre>`,
      text,
    },
    nextLineIndex: lineIndex,
  };
}

function renderTable(input: RenderBlockInput): RenderBlockResult {
  const headerCells = parseTableCells(input.lines[input.lineIndex] ?? '');
  const bodyRows: readonly string[][] = readTableBodyRows({
    lines: input.lines,
    lineIndex: input.lineIndex + 2,
  });
  const bodyRowCount = bodyRows.length;

  const headerHtml = headerCells.map(cell => `<th>${renderInline(cell)}</th>`).join('');
  const bodyHtml = bodyRows
    .map(row => `<tr>${row.map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
    .join('');

  return {
    block: {
      kind: 'html',
      id: createHtmlBlockId(input.blockNumber),
      html: [
        '<div class="conversation-markdown__table-scroll">',
        '<table>',
        `<thead><tr>${headerHtml}</tr></thead>`,
        `<tbody>${bodyHtml}</tbody>`,
        '</table>',
        '</div>',
      ].join(''),
    },
    nextLineIndex: input.lineIndex + 2 + bodyRowCount,
  };
}

interface ReadTableBodyRowsInput {
  readonly lines: readonly string[];
  readonly lineIndex: number;
}

function readTableBodyRows(input: ReadTableBodyRowsInput): readonly string[][] {
  const rows: string[][] = [];
  let lineIndex = input.lineIndex;

  while (lineIndex < input.lines.length) {
    const line = input.lines[lineIndex] ?? '';

    if (!isTableRow(line)) {
      break;
    }

    rows.push(parseTableCells(line));
    lineIndex += 1;
  }

  return rows;
}

function renderList(input: RenderBlockInput): RenderBlockResult {
  const items: string[] = [];
  let lineIndex = input.lineIndex;

  while (lineIndex < input.lines.length) {
    const line = input.lines[lineIndex] ?? '';

    if (!line.startsWith('- ')) {
      break;
    }

    items.push(`<li>${renderInline(line.slice(2))}</li>`);
    lineIndex += 1;
  }

  return {
    block: {
      kind: 'html',
      id: createHtmlBlockId(input.blockNumber),
      html: `<ul>${items.join('')}</ul>`,
    },
    nextLineIndex: lineIndex,
  };
}

function renderParagraph(input: RenderBlockInput): RenderBlockResult {
  const paragraphLines: string[] = [];
  let lineIndex = input.lineIndex;

  while (lineIndex < input.lines.length) {
    const line = input.lines[lineIndex] ?? '';

    if (line === '' || line.startsWith('```') || line.startsWith('- ') || isTableStart({
      lines: input.lines,
      lineIndex,
    })) {
      break;
    }

    paragraphLines.push(line);
    lineIndex += 1;
  }

  return {
    block: {
      kind: 'html',
      id: createHtmlBlockId(input.blockNumber),
      html: `<p>${renderInline(paragraphLines.join('\n'))}</p>`,
    },
    nextLineIndex: lineIndex,
  };
}

function createHtmlBlockId(blockNumber: number): string {
  return `html-${blockNumber}`;
}

interface IsTableStartInput {
  readonly lines: readonly string[];
  readonly lineIndex: number;
}

function isTableStart(input: IsTableStartInput): boolean {
  const currentLine = input.lines[input.lineIndex] ?? '';
  const nextLine = input.lines[input.lineIndex + 1] ?? '';
  return isTableRow(currentLine) && isTableSeparator(nextLine);
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|');
}

function isTableSeparator(line: string): boolean {
  if (!isTableRow(line)) {
    return false;
  }

  const cells = parseTableCells(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTableCells(line: string): string[] {
  return line.slice(1, -1).split('|').map(cell => cell.trim());
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g,
    (_match: string, label: string, url: string) => (
      `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    ),
  );
  const bolded = linked.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return bolded.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
