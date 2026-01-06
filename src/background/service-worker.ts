import type { Message, GetEmbeddingsResponse, SearchQueryResponse, GetModelStatusResponse, GetSettingsResponse, GenerateSummaryResponse, DownloadLLMResponse, GetLLMStatusResponse } from '../shared/messages';
import type { Settings, TextChunk, ModelStatus } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { cosineSimilarity } from '../shared/similarity';
import { getCachedEmbeddings, cacheEmbeddings, clearOldCache } from './embedding-cache';

console.log('[SemanticFind] Service worker started');

// Offscreen document management
let creatingOffscreen: Promise<void> | null = null;
let modelStatus: ModelStatus = 'idle';
let loadProgress = 0;
let loadStatusText = '';

async function setupOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run ML model inference for semantic search',
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

async function sendToOffscreen(action: string, data: Record<string, unknown> = {}): Promise<unknown> {
  await setupOffscreenDocument();
  return chrome.runtime.sendMessage({
    target: 'offscreen',
    action,
    ...data,
  });
}

// Pre-load model on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[SemanticFind] Extension installed, setting up...');
  await setupOffscreenDocument();
  await clearOldCache();
});

// LLM status
let llmStatus: 'not_downloaded' | 'downloading' | 'ready' | 'error' = 'not_downloaded';
let llmProgress = 0;

// Handle model progress updates from offscreen
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'MODEL_PROGRESS') {
    loadProgress = message.progress || 0;
    loadStatusText = message.status || '';
    if (message.status === 'ready') {
      modelStatus = 'ready';
      loadProgress = 100;
    } else if (message.status === 'error') {
      modelStatus = 'error';
    } else {
      modelStatus = 'loading';
    }
  } else if (message.type === 'LLM_PROGRESS') {
    llmProgress = message.progress || 0;
    if (message.status === 'ready') {
      llmStatus = 'ready';
      llmProgress = 100;
    } else if (message.status === 'error') {
      llmStatus = 'error';
    } else if (message.status === 'downloading') {
      llmStatus = 'downloading';
    }
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  console.log('[SemanticFind] Command received:', command);
  if (command === 'toggle-semantic-search') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[SemanticFind] Active tab:', tabs[0]?.id, tabs[0]?.url);
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_OVERLAY' }, (response) => {
          console.log('[SemanticFind] Toggle response:', response, chrome.runtime.lastError?.message);
        });
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  // Ignore offscreen messages
  if ((message as { target?: string }).target === 'offscreen') return;
  if ((message as { type?: string }).type === 'MODEL_PROGRESS') return;

  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'GET_EMBEDDINGS':
      return handleGetEmbeddings(message.chunks, message.url);
    case 'SEARCH_QUERY':
      return handleSearchQuery(message.query, message.chunks);
    case 'GET_MODEL_STATUS':
      return handleGetModelStatus();
    case 'GET_SETTINGS':
      return handleGetSettings();
    case 'UPDATE_SETTINGS':
      return handleUpdateSettings(message.settings);
    case 'GENERATE_SUMMARY':
      return handleGenerateSummary(message.query, message.topResults);
    case 'DOWNLOAD_LLM':
      return handleDownloadLLM();
    case 'GET_LLM_STATUS':
      return handleGetLLMStatus();
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function handleGetEmbeddings(chunks: TextChunk[], url: string): Promise<GetEmbeddingsResponse> {
  try {
    // Check cache first
    const cached = await getCachedEmbeddings(url);
    if (cached && cached.length === chunks.length) {
      const textsMatch = chunks.every((chunk, i) => chunk.text === cached[i].text);
      if (textsMatch) {
        console.log('[SemanticFind] Using cached embeddings');
        return { success: true, chunks: cached };
      }
    }

    // Generate embeddings via offscreen document
    console.log('[SemanticFind] Generating embeddings for', chunks.length, 'chunks');
    const texts = chunks.map((c) => c.text);

    const response = await sendToOffscreen('GENERATE_EMBEDDINGS', { texts }) as { embeddings: (number[] | null)[] };

    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: response.embeddings[i] || undefined,
    }));

    await cacheEmbeddings(url, chunksWithEmbeddings);
    return { success: true, chunks: chunksWithEmbeddings };
  } catch (error) {
    console.error('[SemanticFind] Error generating embeddings:', error);
    return { success: false, error: String(error) };
  }
}

async function handleSearchQuery(query: string, chunks: TextChunk[]): Promise<SearchQueryResponse> {
  try {
    const response = await sendToOffscreen('GENERATE_EMBEDDING', { text: query }) as { embedding: number[] | null };

    if (!response.embedding) {
      return { success: false, error: 'Failed to generate query embedding' };
    }

    const settings = await getSettings();
    const results = chunks
      .filter((chunk) => chunk.embedding)
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(response.embedding!, chunk.embedding!),
        highlighted: false,
      }))
      .filter((result) => result.score >= settings.similarityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return { success: true, results };
  } catch (error) {
    console.error('[SemanticFind] Search error:', error);
    return { success: false, error: String(error) };
  }
}

async function handleGetModelStatus(): Promise<GetModelStatusResponse & { statusText?: string }> {
  try {
    const response = await sendToOffscreen('GET_STATUS') as { status: string; progress: number; statusText: string };
    return {
      status: response.status as ModelStatus,
      progress: response.progress || loadProgress,
      statusText: response.statusText || loadStatusText,
    };
  } catch {
    return { status: modelStatus, progress: loadProgress, statusText: loadStatusText };
  }
}

async function handleGetSettings(): Promise<GetSettingsResponse> {
  const settings = await getSettings();
  return { settings };
}

async function handleUpdateSettings(updates: Partial<Settings>): Promise<{ success: boolean }> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...updates };
    await chrome.storage.local.set({ settings: updated });
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleGenerateSummary(query: string, topResults: { chunk: TextChunk; score: number }[]): Promise<GenerateSummaryResponse> {
  try {
    const results = topResults.map((r) => ({ text: r.chunk.text, score: r.score }));
    const response = await sendToOffscreen('GENERATE_SUMMARY', { query, topResults: results }) as { success: boolean; summary?: string };

    if (response.success && response.summary) {
      return { success: true, summary: response.summary };
    }
    return { success: false, error: 'Failed to generate summary' };
  } catch (error) {
    console.error('[SemanticFind] Summary error:', error);
    return { success: false, error: String(error) };
  }
}

async function handleDownloadLLM(): Promise<DownloadLLMResponse> {
  try {
    const response = await sendToOffscreen('DOWNLOAD_LLM') as { success: boolean };
    return { success: response.success };
  } catch (error) {
    console.error('[SemanticFind] LLM download error:', error);
    return { success: false };
  }
}

async function handleGetLLMStatus(): Promise<GetLLMStatusResponse> {
  try {
    const response = await sendToOffscreen('GET_LLM_STATUS') as { status: string; progress: number };
    return {
      status: response.status as GetLLMStatusResponse['status'],
      progress: response.progress
    };
  } catch {
    return { status: llmStatus, progress: llmProgress };
  }
}

async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get('settings');
    return (result.settings as Settings) || DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
