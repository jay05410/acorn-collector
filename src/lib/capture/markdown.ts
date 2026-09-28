/**
 * Small DOM -> Markdown converter for defuddle's cleaned article HTML. The
 * defuddle core bundle has no Markdown output (that ships in its 766 KB
 * "full" bundle), and the captured text only feeds an LLM, so headings,
 * paragraphs, lists, quotes, code, links and tables are enough.
 */
import { decodeHtmlEntities } from './meta';

const HEADING = /^H([1-6])$/;
const SKIPPED = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'IFRAME',
  'SVG',
  'IMG',
  'PICTURE',
  'VIDEO',
  'AUDIO',
  'BUTTON',
  'FORM',
]);
const BLOCKS = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'FIGURE',
  'FIGCAPTION',
  'DL',
  'DT',
  'DD',
  'ADDRESS',
  'DETAILS',
  'SUMMARY',
]);

function inline(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

function childrenToMarkdown(node: Node): string {
  let out = '';
  for (const child of node.childNodes) out += nodeToMarkdown(child);
  return out;
}

function list(element: Element): string {
  const ordered = element.tagName.toUpperCase() === 'OL';
  const items: string[] = [];
  let index = 1;
  for (const child of element.children) {
    if (child.tagName.toUpperCase() !== 'LI') continue;
    const body = childrenToMarkdown(child)
      .trim()
      .replace(/\n{2,}/g, '\n');
    if (!body) continue;
    const marker = ordered ? `${index}.` : '-';
    items.push(`${marker} ${body}`);
    index += 1;
  }
  return items.length ? `\n\n${items.join('\n')}\n\n` : '';
}

function table(element: Element): string {
  const rows: string[] = [];
  for (const row of element.querySelectorAll('tr')) {
    const cells = [...row.children]
      .filter((cell) => /^T[HD]$/i.test(cell.tagName))
      .map((cell) => inline(cell.textContent ?? '').trim().replace(/\|/g, '\\|'));
    if (cells.some(Boolean)) rows.push(`| ${cells.join(' | ')} |`);
  }
  return rows.length ? `\n\n${rows.join('\n')}\n\n` : '';
}

function link(element: Element): string {
  const text = childrenToMarkdown(element).trim();
  const href = element.getAttribute('href') ?? '';
  if (!text) return '';
  return /^https?:\/\//i.test(href) && href !== text ? `[${text}](${href})` : text;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return inline(node.nodeValue ?? '');
  if (!isElement(node)) return '';
  const tag = node.tagName.toUpperCase();
  if (SKIPPED.has(tag)) return '';

  const heading = HEADING.exec(tag);
  if (heading) {
    const text = inline(node.textContent ?? '').trim();
    return text ? `\n\n${'#'.repeat(Number(heading[1]))} ${text}\n\n` : '';
  }
  switch (tag) {
    case 'BR':
      return '\n';
    case 'HR':
      return '\n\n---\n\n';
    case 'UL':
    case 'OL':
      return list(node);
    case 'TABLE':
      return table(node);
    case 'PRE': {
      const code = (node.textContent ?? '').replace(/\n+$/, '');
      return code ? `\n\n\`\`\`\n${code}\n\`\`\`\n\n` : '';
    }
    case 'BLOCKQUOTE': {
      const body = childrenToMarkdown(node).trim();
      if (!body) return '';
      const quoted = body
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
      return `\n\n${quoted}\n\n`;
    }
    case 'A':
      return link(node);
    case 'STRONG':
    case 'B': {
      const text = childrenToMarkdown(node).trim();
      return text ? `**${text}**` : '';
    }
    case 'EM':
    case 'I': {
      const text = childrenToMarkdown(node).trim();
      return text ? `*${text}*` : '';
    }
    case 'CODE': {
      const text = node.textContent ?? '';
      return text ? `\`${text}\`` : '';
    }
  }
  const body = childrenToMarkdown(node);
  return BLOCKS.has(tag) ? `\n\n${body}\n\n` : body;
}

/** Convert a DOM subtree to compact Markdown. */
export function toMarkdown(root: Node): string {
  return childrenToMarkdown(root)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse an HTML string into an inert document of `doc`'s realm (scripts do
 * not run, images do not load) and convert it. Falls back to tag stripping
 * where HTML parsing is not permitted.
 */
export function htmlToMarkdown(html: string, doc: Document): string {
  try {
    const inert = doc.implementation.createHTMLDocument('');
    inert.body.innerHTML = html;
    return toMarkdown(inert.body);
  } catch {
    const text = html
      .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ');
    return decodeHtmlEntities(text)
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/** `[text](http…)` as emitted by `link`, allowing one level of parentheses in the URL. */
const MARKDOWN_LINK = /\[([^\]\n]*)\]\(https?:\/\/[^\s()]*(?:\([^\s()]*\)[^\s()]*)*\)/gi;
/** Heading, list, quote and fence markers at the start of a line (nested too). */
const LINE_MARKERS = /^[ \t]*(?:(?:#{1,6}|>|-|\d+\.|```)(?:[ \t]+|$))+/gm;

/**
 * Plain text of Markdown written by `toMarkdown`, for comparing it with DOM
 * text (innerText): keeps link text, drops link targets, emphasis and code
 * markers, heading/list/quote syntax, rules and table pipes, and collapses
 * whitespace. Apply it to both sides of a comparison.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(MARKDOWN_LINK, '$1')
    .replace(LINE_MARKERS, '')
    .replace(/^-{3,}$/gm, ' ')
    .replace(/\\?\|/g, ' ')
    .replace(/\*+|`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
