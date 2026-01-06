import type { TextChunk } from '../shared/types';

// Elements to skip when extracting text
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
  'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'MAP', 'TEMPLATE',
  'NAV', 'HEADER', 'FOOTER', 'ASIDE',
]);

// Classes/IDs that typically indicate non-content areas
const SKIP_PATTERNS = [
  /nav/i, /menu/i, /sidebar/i, /footer/i, /header/i,
  /breadcrumb/i, /advertisement/i, /social/i, /share/i,
  /comment/i, /related/i, /recommend/i, /popular/i,
  /widget/i, /banner/i, /promo/i, /sponsor/i,
];

// Check if element or its ancestors should be skipped
function shouldSkipElement(element: Element | null): boolean {
  let current = element;
  let depth = 0;

  while (current && depth < 5) {
    // Check tag
    if (SKIP_TAGS.has(current.tagName)) return true;

    // Check role
    const role = current.getAttribute('role');
    if (role && ['navigation', 'banner', 'contentinfo', 'complementary'].includes(role)) {
      return true;
    }

    // Check class/id against patterns
    const classAndId = `${current.className} ${current.id}`;
    for (const pattern of SKIP_PATTERNS) {
      if (pattern.test(classAndId)) return true;
    }

    current = current.parentElement;
    depth++;
  }

  return false;
}

// Generate unique ID for chunks
let chunkIdCounter = 0;
function generateChunkId(): string {
  return `chunk-${Date.now()}-${chunkIdCounter++}`;
}

interface TextNode {
  text: string;
  node: Node;
  startOffset: number;
}

// Extract visible text from the page
export function extractPageText(): TextNode[] {
  const textNodes: TextNode[] = [];

  // Try to find main content area first
  const mainContent = document.querySelector('main, article, [role="main"], .content, .post, .entry, #content, #main, .mw-body-content');
  const searchRoot = mainContent || document.body;

  console.log('[SemanticFind] Extracting text from:', mainContent ? 'main content area' : 'full body');

  const walker = document.createTreeWalker(
    searchRoot,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip non-content elements
        if (shouldSkipElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip empty text
        const text = node.textContent?.trim();
        if (!text) return NodeFilter.FILTER_REJECT;

        // Skip very short text (likely buttons, labels)
        if (text.length < 3) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim() || '';
    if (text) {
      textNodes.push({
        text,
        node,
        startOffset: currentOffset,
      });
      currentOffset += text.length + 1; // +1 for space between nodes
    }
  }

  return textNodes;
}

// Chunk text into segments of approximately targetSize characters
export function chunkText(textNodes: TextNode[], targetSize: number = 200): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentChunkText = '';
  let currentChunkStart = 0;
  let lastOffset = 0;

  for (const { text, startOffset } of textNodes) {
    // If adding this text would exceed target size and we have content, finalize chunk
    if (currentChunkText.length > 0 && currentChunkText.length + text.length > targetSize) {
      chunks.push({
        id: generateChunkId(),
        text: currentChunkText.trim(),
        startOffset: currentChunkStart,
        endOffset: lastOffset,
      });
      currentChunkText = '';
      currentChunkStart = startOffset;
    }

    // Start new chunk if empty
    if (currentChunkText.length === 0) {
      currentChunkStart = startOffset;
    }

    currentChunkText += (currentChunkText.length > 0 ? ' ' : '') + text;
    lastOffset = startOffset + text.length;
  }

  // Don't forget the last chunk
  if (currentChunkText.trim().length > 0) {
    chunks.push({
      id: generateChunkId(),
      text: currentChunkText.trim(),
      startOffset: currentChunkStart,
      endOffset: lastOffset,
    });
  }

  return chunks;
}

// Find the DOM range for a given text chunk
export function findChunkInDOM(chunkText: string): Range | null {
  const searchText = chunkText.slice(0, 50); // Use first 50 chars for search
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const nodeText = node.textContent || '';
    const index = nodeText.indexOf(searchText);
    if (index !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, Math.min(index + chunkText.length, nodeText.length));
        return range;
      } catch {
        continue;
      }
    }
  }

  return null;
}

// Get full page text as single string
export function getFullPageText(): string {
  const textNodes = extractPageText();
  return textNodes.map((n) => n.text).join(' ');
}
