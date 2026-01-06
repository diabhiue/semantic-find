import type { TextChunk, SearchResult, Settings } from '../shared/types';
import type { GetEmbeddingsResponse, SearchQueryResponse, GetSettingsResponse, GenerateSummaryResponse } from '../shared/messages';
import { extractPageText, chunkText } from './text-chunker';
import { highlightText, clearAllHighlights, setActiveHighlight } from './highlighter';
import { createOverlay, show, hide, toggle, updateResults, updateSummary, setStatus, setSettings, setOnSearch, setOnNavigate, setOnClose, setOnRequestSummary } from './overlay';

console.log('[SemanticFind] Content script loaded on:', window.location.href);

// State
let pageChunks: TextChunk[] = [];
let isIndexed = false;
let currentResults: SearchResult[] = [];
let settings: Settings | null = null;

// Initialize
async function init(): Promise<void> {
  // Load settings
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as GetSettingsResponse;
  settings = response.settings;

  // Create overlay
  createOverlay();
  setSettings(settings);

  // Set up callbacks
  setOnSearch(handleSearch);
  setOnNavigate(handleNavigate);
  setOnClose(handleClose);
  setOnRequestSummary(handleRequestSummary);
}

// Index page content
async function indexPage(): Promise<boolean> {
  if (isIndexed && pageChunks.length > 0) {
    return true;
  }

  setStatus('Indexing...');

  try {
    // Extract and chunk text
    const textNodes = extractPageText();
    const chunkSize = settings?.chunkSize || 200;
    pageChunks = chunkText(textNodes, chunkSize);

    if (pageChunks.length === 0) {
      setStatus('No text found');
      return false;
    }

    console.log('[SemanticFind] Extracted', pageChunks.length, 'chunks');

    // Get embeddings from service worker
    const response = await chrome.runtime.sendMessage({
      type: 'GET_EMBEDDINGS',
      chunks: pageChunks,
      url: window.location.href,
    }) as GetEmbeddingsResponse;

    if (!response.success || !response.chunks) {
      setStatus('Indexing failed');
      console.error('[SemanticFind] Failed to get embeddings:', response.error);
      return false;
    }

    pageChunks = response.chunks;
    isIndexed = true;
    setStatus('');
    console.log('[SemanticFind] Page indexed successfully');
    return true;
  } catch (error) {
    console.error('[SemanticFind] Error indexing page:', error);
    setStatus('Error');
    return false;
  }
}

// Handle search query
async function handleSearch(query: string): Promise<void> {
  console.log('[SemanticFind] Searching for:', query);

  // Index page if not already done
  if (!isIndexed) {
    const indexed = await indexPage();
    if (!indexed) {
      updateResults([]);
      return;
    }
  }

  setStatus('Searching...');

  try {
    // Send search query to service worker
    console.log('[SemanticFind] Sending search query, chunks have embeddings:', pageChunks.filter(c => c.embedding).length);
    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_QUERY',
      query,
      chunks: pageChunks,
    }) as SearchQueryResponse;

    console.log('[SemanticFind] Search response:', response);

    if (!response.success || !response.results) {
      setStatus('Search failed');
      console.error('[SemanticFind] Search failed:', response.error);
      updateResults([]);
      return;
    }

    currentResults = response.results;
    console.log('[SemanticFind] Found', currentResults.length, 'results');
    if (currentResults.length > 0) {
      console.log('[SemanticFind] Top result:', currentResults[0].score, currentResults[0].chunk.text.substring(0, 100));
    }

    // Clear previous highlights
    clearAllHighlights();

    // Highlight matching text
    let highlightedCount = 0;
    for (const result of currentResults) {
      const success = highlightText(result.chunk.id, result.chunk.text);
      if (success) highlightedCount++;
    }
    console.log('[SemanticFind] Highlighted', highlightedCount, 'of', currentResults.length, 'results');

    setStatus('');
    updateResults(currentResults);
  } catch (error) {
    console.error('[SemanticFind] Search error:', error);
    setStatus('Error');
    updateResults([]);
  }
}

// Handle navigation between results
function handleNavigate(index: number): void {
  if (index < 0 || index >= currentResults.length) return;

  const result = currentResults[index];
  setActiveHighlight(result.chunk.id);
}

// Handle overlay close
function handleClose(): void {
  clearAllHighlights();
}

// Handle AI summary request
async function handleRequestSummary(query: string, results: SearchResult[]): Promise<void> {
  if (!settings?.aiSummaryEnabled) return;

  const topResults = results.slice(0, 5).map((r) => ({
    chunk: r.chunk,
    score: r.score,
  }));

  // Debug: log what we're sending to the LLM
  console.log('[SemanticFind] Summary request - Query:', query);
  console.log('[SemanticFind] Summary request - Top results:');
  topResults.forEach((r, i) => {
    console.log(`  [${i + 1}] Score: ${r.score.toFixed(3)} | Text: "${r.chunk.text.substring(0, 100)}..."`);
  });

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_SUMMARY',
      query,
      topResults,
    }) as GenerateSummaryResponse;

    if (response.success && response.summary) {
      updateSummary(response.summary);
    }
  } catch (error) {
    console.error('[SemanticFind] Summary generation error:', error);
  }
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[SemanticFind] Content script received message:', message);
  if (message.type === 'TOGGLE_OVERLAY') {
    console.log('[SemanticFind] Toggling overlay');
    toggle();
    // Index page when overlay is shown
    if (document.querySelector('#semantic-find-overlay.visible')) {
      indexPage();
    }
    sendResponse({ success: true });
  }
  return true;
});

// Initialize on load
init().catch(console.error);
