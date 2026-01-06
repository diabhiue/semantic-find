// Text chunk with its embedding
export interface TextChunk {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  embedding?: number[];
}

// Search result with similarity score
export interface SearchResult {
  chunk: TextChunk;
  score: number;
  highlighted: boolean;
}

// Settings stored in chrome.storage
export interface Settings {
  chunkSize: number;
  similarityThreshold: number;
  aiSummaryEnabled: boolean;
  llmModelDownloaded: boolean;
}

// Page embedding cache entry
export interface PageCache {
  url: string;
  timestamp: number;
  chunks: TextChunk[];
}

// Model loading status
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

// LLM status for AI summary
export type LLMStatus = 'not_downloaded' | 'downloading' | 'ready' | 'generating' | 'error';

export const DEFAULT_SETTINGS: Settings = {
  chunkSize: 200,
  similarityThreshold: 0.3,
  aiSummaryEnabled: false,
  llmModelDownloaded: false,
};
