export interface ReaderSearchRange {
  start: number;
  end: number;
}

export interface NormalizedPoint {
  node: Text;
  offset: number;
}

export const collectTextNodes = (root: ParentNode): Text[] => {  const doc = root.ownerDocument;
  if (!doc) return [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,button,mark[data-reader-search-match="true"]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
};

export const buildNormalizedPoints = (nodes: Text[]) => {  const points: NormalizedPoint[] = [];
  let normalizedText = '';
  let previousWasSpace = true;
  nodes.forEach((node) => {
    Array.from(node.data).forEach((character, offset) => {
      if (/\s/.test(character)) {
        if (!previousWasSpace) {
          normalizedText += ' ';
          points.push({ node, offset });
          previousWasSpace = true;
        }
        return;
      }
      normalizedText += character;
      points.push({ node, offset });
      previousWasSpace = false;
    });
  });
  if (normalizedText.endsWith(' ')) {
    normalizedText = normalizedText.slice(0, -1);
    points.pop();
  }
  return { normalizedText, points };
};

export const findReaderSearchRanges = (text: string, query: string, caseSensitive: boolean, wholeWord = false): ReaderSearchRange[] => {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  if (!normalizedQuery || !text) return [];
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = wholeWord ? '\\b' : '';
  const regex = new RegExp(`${boundary}${escaped}${boundary}`, flags);

  const ranges: ReaderSearchRange[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    ranges.push({ start: match.index, end: match.index + match[0].length });
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return ranges;
};

const SNIPPET_PAD = 42;

export const buildSearchSnippet = (text: string, start: number, end: number) => {
  const snippetStart = Math.max(0, start - SNIPPET_PAD);
  const snippetEnd = Math.min(text.length, end + SNIPPET_PAD);
  const core = text.slice(snippetStart, snippetEnd).trim();
  return `${snippetStart > 0 ? '…' : ''}${core}${snippetEnd < text.length ? '…' : ''}`;
};

export interface SearchSnippetSegment {
  text: string;
  matched: boolean;
}

export const splitReaderSearchSnippet = (
  snippet: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean
): SearchSnippetSegment[] => {
  const ranges = findReaderSearchRanges(snippet, query, caseSensitive, wholeWord);
  if (!ranges.length) return [{ text: snippet, matched: false }];

  const segments: SearchSnippetSegment[] = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) {
      segments.push({ text: snippet.slice(cursor, range.start), matched: false });
    }
    segments.push({ text: snippet.slice(range.start, range.end), matched: true });
    cursor = range.end;
  });
  if (cursor < snippet.length) {
    segments.push({ text: snippet.slice(cursor), matched: false });
  }
  return segments;
};

export const unwrapReaderSearchMatches = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('mark[data-reader-search-match="true"]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
};

const SEARCH_MARK_CLASS = 'rounded-[3px] bg-[rgba(var(--bit-accent-rgb),0.22)] px-0.5 text-bit-text';
const SEARCH_ACTIVE_MARK_CLASS = 'bg-[rgba(var(--bit-accent-rgb),0.42)] ring-2 ring-bit-accent/70';

export const applyReaderSearch = (
  root: ParentNode,
  query: string,
  caseSensitive: boolean,
  wholeWord = false
): { total: number; marks: HTMLElement[]; snippets: string[] } => {
  unwrapReaderSearchMatches(root);
  if (!query.trim() || !root.textContent) return { total: 0, marks: [], snippets: [] };

  const nodes = collectTextNodes(root);
  if (!nodes.length) return { total: 0, marks: [], snippets: [] };
  const doc = root.ownerDocument;
  if (!doc) return { total: 0, marks: [], snippets: [] };
  const { normalizedText, points } = buildNormalizedPoints(nodes);
  const ranges = findReaderSearchRanges(normalizedText, query, caseSensitive, wholeWord);
  const marks: HTMLElement[] = [];
  const snippets: string[] = [];

  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index];
    const startPoint = points[range.start];
    const endPoint = points[range.end] || (range.end === normalizedText.length ? points[range.end - 1] : undefined);
    if (!startPoint || !endPoint) continue;

    const domRange = doc.createRange();
    domRange.setStart(startPoint.node, startPoint.offset);
    domRange.setEnd(endPoint.node, range.end === normalizedText.length ? endPoint.node.data.length : Math.min(endPoint.offset + 1, endPoint.node.data.length));

    const mark = doc.createElement('mark');
    mark.setAttribute('data-reader-search-match', 'true');
    mark.className = SEARCH_MARK_CLASS;
    try {
      domRange.surroundContents(mark);
    } catch {
      mark.appendChild(domRange.extractContents());
      domRange.insertNode(mark);
    }
    marks.unshift(mark);
    snippets.unshift(buildSearchSnippet(normalizedText, range.start, range.end));
  }

  return { total: marks.length, marks, snippets };
};

export const setReaderSearchActiveMark = (marks: HTMLElement[], activeIndex: number): HTMLElement | null => {
  let activeMark: HTMLElement | null = null;
  marks.forEach((mark, index) => {
    if (index === activeIndex) {
      mark.classList.add(SEARCH_ACTIVE_MARK_CLASS);
      activeMark = mark;
    } else {
      mark.classList.remove(SEARCH_ACTIVE_MARK_CLASS);
    }
  });
  return activeMark;
};
