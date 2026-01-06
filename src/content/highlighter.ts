// Manages text highlighting using CSS Custom Highlight API
// This approach doesn't modify the DOM, similar to Chrome's built-in Ctrl+F

const HIGHLIGHT_NAME = 'semantic-find-highlight';
const ACTIVE_HIGHLIGHT_NAME = 'semantic-find-highlight-active';

// Track which chunks have been highlighted
const highlightedChunks: Map<string, Range[]> = new Map();
let activeHighlightId: string | null = null;

// Check if CSS Custom Highlight API is supported
const supportsHighlightAPI = typeof CSS !== 'undefined' && 'highlights' in CSS;

// Inject styles for highlight pseudo-elements (Chrome yellow colors)
function injectHighlightStyles(): void {
  if (document.getElementById('semantic-find-highlight-styles')) return;

  const style = document.createElement('style');
  style.id = 'semantic-find-highlight-styles';
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background-color: #ffff00;
    }
    ::highlight(${ACTIVE_HIGHLIGHT_NAME}) {
      background-color: #ff9632;
    }
  `;
  document.head.appendChild(style);
}

// Create a highlight for a text chunk
export function highlightText(chunkId: string, searchText: string): boolean {
  // Remove existing highlight for this chunk
  removeHighlight(chunkId);

  if (!supportsHighlightAPI) {
    return highlightTextFallback(chunkId, searchText);
  }

  injectHighlightStyles();

  // Find text ranges in DOM
  const ranges = findTextRanges(searchText);
  if (ranges.length === 0) {
    return false;
  }

  highlightedChunks.set(chunkId, ranges);
  updateHighlights();
  return true;
}

// Find all ranges matching the search text
function findTextRanges(searchText: string): Range[] {
  const normalizedSearch = normalizeText(searchText);
  if (normalizedSearch.length < 3) return [];

  const ranges: Range[] = [];

  // Try different search strategies
  const searchStrategies = [
    normalizedSearch,
    normalizedSearch.substring(0, Math.min(100, normalizedSearch.length)),
    normalizedSearch.substring(0, Math.min(60, normalizedSearch.length)),
    normalizedSearch.substring(0, Math.min(40, normalizedSearch.length)),
    getFirstWords(normalizedSearch, 8),
    getFirstWords(normalizedSearch, 5),
    getFirstWords(normalizedSearch, 3),
  ];

  for (const searchStr of searchStrategies) {
    if (!searchStr || searchStr.length < 3) continue;

    const range = findRangeForText(searchStr);
    if (range) {
      ranges.push(range);
      break;
    }
  }

  return ranges;
}

// Get first N words from text
function getFirstWords(text: string, count: number): string {
  return text.split(/\s+/).slice(0, count).join(' ');
}

// Find a range for specific text using TreeWalker
function findRangeForText(searchText: string): Range | null {
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip hidden elements and scripts
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  // Build a map of normalized positions to actual DOM positions
  const textNodes: { node: Text; start: number; text: string }[] = [];
  let totalLength = 0;
  let fullText = '';

  let node: Node | null;
  while ((node = treeWalker.nextNode())) {
    const textNode = node as Text;
    const nodeText = textNode.textContent || '';
    if (nodeText.trim().length === 0) continue;

    textNodes.push({
      node: textNode,
      start: totalLength,
      text: nodeText,
    });

    fullText += nodeText + ' ';
    totalLength = fullText.length;
  }

  // Normalize and search
  const normalizedFull = normalizeText(fullText);
  const matchIndex = normalizedFull.indexOf(searchText);

  if (matchIndex === -1) return null;

  // Map normalized position back to actual DOM position
  const matchEnd = matchIndex + searchText.length;

  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  let normalizedPos = 0;

  for (const { node: textNode, text } of textNodes) {
    const normalizedNodeText = normalizeText(text);
    const nodeStartNorm = normalizedPos;
    const nodeEndNorm = normalizedPos + normalizedNodeText.length;

    // Find start position
    if (!startNode && matchIndex >= nodeStartNorm && matchIndex < nodeEndNorm) {
      startNode = textNode;
      startOffset = mapNormalizedToActual(text, matchIndex - nodeStartNorm);
    }

    // Find end position
    if (startNode && matchEnd > nodeStartNorm && matchEnd <= nodeEndNorm) {
      endNode = textNode;
      endOffset = mapNormalizedToActual(text, matchEnd - nodeStartNorm);
      break;
    }

    // Handle case where match ends exactly at node boundary
    if (startNode && matchEnd === nodeEndNorm) {
      endNode = textNode;
      endOffset = text.length;
      break;
    }

    normalizedPos = nodeEndNorm + 1; // +1 for space between nodes
  }

  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.length));
      range.setEnd(endNode, Math.min(endOffset, endNode.length));
      return range;
    } catch {
      return null;
    }
  }

  return null;
}

// Map normalized text position to actual text position
function mapNormalizedToActual(text: string, normalizedPos: number): number {
  let normIndex = 0;
  let inWhitespace = false;

  for (let i = 0; i < text.length; i++) {
    if (normIndex >= normalizedPos) {
      return i;
    }

    const char = text[i];
    const isSpace = /\s/.test(char);

    if (isSpace) {
      if (!inWhitespace) {
        normIndex++;
        inWhitespace = true;
      }
    } else {
      normIndex++;
      inWhitespace = false;
    }
  }

  return text.length;
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Update the CSS highlights registry
function updateHighlights(): void {
  if (!supportsHighlightAPI) return;

  // Collect all ranges except active
  const allRanges: Range[] = [];
  const activeRanges: Range[] = [];

  for (const [chunkId, ranges] of highlightedChunks) {
    if (chunkId === activeHighlightId) {
      activeRanges.push(...ranges);
    } else {
      allRanges.push(...ranges);
    }
  }

  // Clear and set highlights
  CSS.highlights.delete(HIGHLIGHT_NAME);
  CSS.highlights.delete(ACTIVE_HIGHLIGHT_NAME);

  if (allRanges.length > 0) {
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...allRanges));
  }

  if (activeRanges.length > 0) {
    CSS.highlights.set(ACTIVE_HIGHLIGHT_NAME, new Highlight(...activeRanges));
  }
}

// Remove highlight by chunk ID
export function removeHighlight(chunkId: string): void {
  highlightedChunks.delete(chunkId);

  if (activeHighlightId === chunkId) {
    activeHighlightId = null;
  }

  updateHighlights();
}

// Remove all highlights
export function clearAllHighlights(): void {
  highlightedChunks.clear();
  activeHighlightId = null;

  if (supportsHighlightAPI) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
    CSS.highlights.delete(ACTIVE_HIGHLIGHT_NAME);
  } else {
    // Fallback: remove all highlight spans
    document.querySelectorAll('.semantic-find-highlight').forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });
  }
}

// Set active highlight and scroll to it
export function setActiveHighlight(chunkId: string): void {
  activeHighlightId = chunkId;
  updateHighlights();

  // Scroll to the first range of the active highlight
  const ranges = highlightedChunks.get(chunkId);
  if (ranges && ranges.length > 0) {
    const range = ranges[0];
    const rect = range.getBoundingClientRect();

    // Scroll the element into view
    const element = range.startContainer.parentElement;
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } else {
      // Fallback: scroll to the range position
      window.scrollTo({
        top: window.scrollY + rect.top - window.innerHeight / 2,
        behavior: 'smooth',
      });
    }
  }
}

// Get number of highlights
export function getHighlightCount(): number {
  return highlightedChunks.size;
}

// Fallback for browsers without CSS Custom Highlight API
function highlightTextFallback(chunkId: string, searchText: string): boolean {
  const range = findRangeForText(normalizeText(searchText));
  if (!range) return false;

  try {
    const span = document.createElement('span');
    span.className = 'semantic-find-highlight';
    span.dataset.chunkId = chunkId;

    // Check if range crosses element boundaries
    if (range.startContainer === range.endContainer) {
      range.surroundContents(span);
      highlightedChunks.set(chunkId, [range]);
      return true;
    }

    // For cross-element ranges, highlight each text node separately
    const textNodes = getTextNodesInRange(range);
    const ranges: Range[] = [];

    for (const { node, start, end } of textNodes) {
      try {
        const nodeRange = document.createRange();
        nodeRange.setStart(node, start);
        nodeRange.setEnd(node, end);

        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'semantic-find-highlight';
        highlightSpan.dataset.chunkId = chunkId;
        nodeRange.surroundContents(highlightSpan);
        ranges.push(nodeRange);
      } catch {
        // Skip nodes that can't be highlighted
      }
    }

    if (ranges.length > 0) {
      highlightedChunks.set(chunkId, ranges);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

// Get all text nodes within a range
function getTextNodesInRange(range: Range): { node: Text; start: number; end: number }[] {
  const result: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null = walker.currentNode;
  if (node.nodeType !== Node.TEXT_NODE) {
    node = walker.nextNode();
  }

  while (node) {
    if (range.intersectsNode(node)) {
      const textNode = node as Text;
      let start = 0;
      let end = textNode.length;

      if (node === range.startContainer) {
        start = range.startOffset;
      }
      if (node === range.endContainer) {
        end = range.endOffset;
      }

      if (start < end) {
        result.push({ node: textNode, start, end });
      }
    }
    node = walker.nextNode();
  }

  return result;
}
