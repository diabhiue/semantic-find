import type { TextChunk, SearchResult, ModelStatus, LLMStatus, Settings } from './types';

// Message types for communication between content script and service worker

export type MessageType =
  | 'GET_EMBEDDINGS'
  | 'SEARCH_QUERY'
  | 'GET_MODEL_STATUS'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GENERATE_SUMMARY'
  | 'DOWNLOAD_LLM'
  | 'GET_LLM_STATUS'
  | 'TOGGLE_OVERLAY';

// Request messages
export interface GetEmbeddingsRequest {
  type: 'GET_EMBEDDINGS';
  chunks: TextChunk[];
  url: string;
}

export interface SearchQueryRequest {
  type: 'SEARCH_QUERY';
  query: string;
  chunks: TextChunk[];
}

export interface GetModelStatusRequest {
  type: 'GET_MODEL_STATUS';
}

export interface GetSettingsRequest {
  type: 'GET_SETTINGS';
}

export interface UpdateSettingsRequest {
  type: 'UPDATE_SETTINGS';
  settings: Partial<Settings>;
}

export interface GenerateSummaryRequest {
  type: 'GENERATE_SUMMARY';
  query: string;
  topResults: SearchResult[];
}

export interface DownloadLLMRequest {
  type: 'DOWNLOAD_LLM';
}

export interface GetLLMStatusRequest {
  type: 'GET_LLM_STATUS';
}

export interface ToggleOverlayRequest {
  type: 'TOGGLE_OVERLAY';
}

export type Message =
  | GetEmbeddingsRequest
  | SearchQueryRequest
  | GetModelStatusRequest
  | GetSettingsRequest
  | UpdateSettingsRequest
  | GenerateSummaryRequest
  | DownloadLLMRequest
  | GetLLMStatusRequest
  | ToggleOverlayRequest;

// Response types
export interface GetEmbeddingsResponse {
  success: boolean;
  chunks?: TextChunk[];
  error?: string;
}

export interface SearchQueryResponse {
  success: boolean;
  results?: SearchResult[];
  error?: string;
}

export interface GetModelStatusResponse {
  status: ModelStatus;
  progress?: number;
}

export interface GetSettingsResponse {
  settings: Settings;
}

export interface GenerateSummaryResponse {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface DownloadLLMResponse {
  success: boolean;
  error?: string;
}

export interface GetLLMStatusResponse {
  status: LLMStatus;
  progress?: number;
}
