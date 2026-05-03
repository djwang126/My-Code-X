export interface RenderConversationMarkdownInput {
  readonly text: string;
}

export interface ConversationMarkdownTextInline {
  readonly kind: 'text';
  readonly text: string;
}

export interface ConversationMarkdownStrongInline {
  readonly kind: 'strong';
  readonly inlines: readonly ConversationMarkdownInline[];
}

export interface ConversationMarkdownCodeInline {
  readonly kind: 'code';
  readonly text: string;
}

export interface ConversationMarkdownLinkInline {
  readonly kind: 'link';
  readonly href: string;
  readonly inlines: readonly ConversationMarkdownInline[];
}

export type ConversationMarkdownInline =
  | ConversationMarkdownTextInline
  | ConversationMarkdownStrongInline
  | ConversationMarkdownCodeInline
  | ConversationMarkdownLinkInline;

export interface ConversationMarkdownParagraphBlock {
  readonly kind: 'paragraph';
  readonly id: string;
  readonly inlines: readonly ConversationMarkdownInline[];
}

export interface ConversationMarkdownListBlock {
  readonly kind: 'list';
  readonly id: string;
  readonly items: readonly (readonly ConversationMarkdownInline[])[];
}

export interface ConversationMarkdownCodeBlock {
  readonly kind: 'code';
  readonly id: string;
  readonly text: string;
}

export interface ConversationMarkdownTableBlock {
  readonly kind: 'table';
  readonly id: string;
  readonly headers: readonly (readonly ConversationMarkdownInline[])[];
  readonly rows: readonly (readonly (readonly ConversationMarkdownInline[])[])[];
}

export type ConversationMarkdownBlock =
  | ConversationMarkdownParagraphBlock
  | ConversationMarkdownListBlock
  | ConversationMarkdownCodeBlock
  | ConversationMarkdownTableBlock;

export interface RenderConversationMarkdownResult {
  readonly blocks: readonly ConversationMarkdownBlock[];
}

interface RenderBlockResult {
  readonly block: ConversationMarkdownBlock;
  readonly nextLineIndex: number;
}

export function renderConversationMarkdown(input: RenderConversationMarkdownInput): RenderConversationMarkdownResult {
  const lines = input.text.split('\n');
  const blocks: ConversationMarkdownBlock[] = [];
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

  return {
    block: {
      kind: 'code',
      id: `code-${input.codeBlockNumber}`,
      text: codeLines.join('\n'),
    },
    nextLineIndex: lineIndex,
  };
}

function renderTable(input: RenderBlockInput): RenderBlockResult {
  const headerCells = parseTableCells(input.lines[input.lineIndex] ?? '');
  const bodyRows = readTableBodyRows({
    lines: input.lines,
    lineIndex: input.lineIndex + 2,
  });

  return {
    block: {
      kind: 'table',
      id: createBlockId(input.blockNumber),
      headers: headerCells.map(cell => renderConversationMarkdownInlines({ text: cell })),
      rows: bodyRows.map(row => row.map(cell => renderConversationMarkdownInlines({ text: cell }))),
    },
    nextLineIndex: input.lineIndex + 2 + bodyRows.length,
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
  const items: (readonly ConversationMarkdownInline[])[] = [];
  let lineIndex = input.lineIndex;

  while (lineIndex < input.lines.length) {
    const line = input.lines[lineIndex] ?? '';

    if (!line.startsWith('- ')) {
      break;
    }

    items.push(renderConversationMarkdownInlines({ text: line.slice(2) }));
    lineIndex += 1;
  }

  return {
    block: {
      kind: 'list',
      id: createBlockId(input.blockNumber),
      items,
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
      kind: 'paragraph',
      id: createBlockId(input.blockNumber),
      inlines: renderConversationMarkdownInlines({ text: paragraphLines.join('\n') }),
    },
    nextLineIndex: lineIndex,
  };
}

function createBlockId(blockNumber: number): string {
  return `block-${blockNumber}`;
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

interface RenderConversationMarkdownInlinesInput {
  readonly text: string;
}

function renderConversationMarkdownInlines(
  input: RenderConversationMarkdownInlinesInput,
): readonly ConversationMarkdownInline[] {
  const inlines: ConversationMarkdownInline[] = [];
  let position = 0;

  while (position < input.text.length) {
    const match = findNextInlineToken({
      text: input.text,
      startIndex: position,
    });

    if (!match) {
      inlines.push({
        kind: 'text',
        text: input.text.slice(position),
      });
      break;
    }

    if (match.startIndex > position) {
      inlines.push({
        kind: 'text',
        text: input.text.slice(position, match.startIndex),
      });
    }

    inlines.push(match.inline);
    position = match.endIndex;
  }

  return inlines;
}

interface InlineTokenMatch {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly inline: ConversationMarkdownInline;
}

interface FindNextInlineTokenInput {
  readonly text: string;
  readonly startIndex: number;
}

function findNextInlineToken(input: FindNextInlineTokenInput): InlineTokenMatch | null {
  const matches = [
    findNextCodeInlineToken(input),
    findNextLinkInlineToken(input),
    findNextStrongInlineToken(input),
  ].filter((match): match is InlineTokenMatch => match !== null);

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((left, right) => (right.startIndex < left.startIndex ? right : left));
}

function findNextCodeInlineToken(input: FindNextInlineTokenInput): InlineTokenMatch | null {
  const match = /`([^`]+)`/.exec(input.text.slice(input.startIndex));

  if (!match || match.index === undefined) {
    return null;
  }

  const startIndex = input.startIndex + match.index;
  const rawText = match[0] ?? '';
  const codeText = match[1] ?? '';

  return {
    startIndex,
    endIndex: startIndex + rawText.length,
    inline: {
      kind: 'code',
      text: codeText,
    },
  };
}

function findNextLinkInlineToken(input: FindNextInlineTokenInput): InlineTokenMatch | null {
  const match = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/.exec(input.text.slice(input.startIndex));

  if (!match || match.index === undefined) {
    return null;
  }

  const startIndex = input.startIndex + match.index;
  const rawText = match[0] ?? '';
  const label = match[1] ?? '';
  const href = match[2] ?? '';

  return {
    startIndex,
    endIndex: startIndex + rawText.length,
    inline: {
      kind: 'link',
      href,
      inlines: renderConversationMarkdownInlines({ text: label }),
    },
  };
}

function findNextStrongInlineToken(input: FindNextInlineTokenInput): InlineTokenMatch | null {
  const match = /\*\*([^*]+)\*\*/.exec(input.text.slice(input.startIndex));

  if (!match || match.index === undefined) {
    return null;
  }

  const startIndex = input.startIndex + match.index;
  const rawText = match[0] ?? '';
  const strongText = match[1] ?? '';

  return {
    startIndex,
    endIndex: startIndex + rawText.length,
    inline: {
      kind: 'strong',
      inlines: renderConversationMarkdownInlines({ text: strongText }),
    },
  };
}
