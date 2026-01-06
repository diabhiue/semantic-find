import { DEFAULT_SETTINGS } from '../src/shared/types';
import type { TextChunk, SearchResult, Settings, PageCache } from '../src/shared/types';

describe('Types and Defaults', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('chunkSize');
      expect(DEFAULT_SETTINGS).toHaveProperty('similarityThreshold');
      expect(DEFAULT_SETTINGS).toHaveProperty('aiSummaryEnabled');
      expect(DEFAULT_SETTINGS).toHaveProperty('llmModelDownloaded');
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_SETTINGS.chunkSize).toBe(200);
      expect(DEFAULT_SETTINGS.similarityThreshold).toBe(0.3);
      expect(DEFAULT_SETTINGS.aiSummaryEnabled).toBe(false);
      expect(DEFAULT_SETTINGS.llmModelDownloaded).toBe(false);
    });

    it('should have positive chunk size', () => {
      expect(DEFAULT_SETTINGS.chunkSize).toBeGreaterThan(0);
    });

    it('should have threshold between 0 and 1', () => {
      expect(DEFAULT_SETTINGS.similarityThreshold).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_SETTINGS.similarityThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('Type structures', () => {
    it('should allow valid TextChunk', () => {
      const chunk: TextChunk = {
        id: 'test-id',
        text: 'Test text content',
        startOffset: 0,
        endOffset: 17,
        embedding: [0.1, 0.2, 0.3],
      };

      expect(chunk.id).toBeDefined();
      expect(chunk.text).toBeDefined();
    });

    it('should allow TextChunk without embedding', () => {
      const chunk: TextChunk = {
        id: 'test-id',
        text: 'Test text',
        startOffset: 0,
        endOffset: 9,
      };

      expect(chunk.embedding).toBeUndefined();
    });

    it('should allow valid SearchResult', () => {
      const result: SearchResult = {
        chunk: {
          id: 'chunk-1',
          text: 'Test',
          startOffset: 0,
          endOffset: 4,
        },
        score: 0.85,
        highlighted: false,
      };

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should allow valid Settings', () => {
      const settings: Settings = {
        chunkSize: 150,
        similarityThreshold: 0.4,
        aiSummaryEnabled: true,
        llmModelDownloaded: true,
      };

      expect(settings).toBeDefined();
    });

    it('should allow valid PageCache', () => {
      const cache: PageCache = {
        url: 'https://example.com',
        timestamp: Date.now(),
        chunks: [
          {
            id: 'chunk-1',
            text: 'Cached text',
            startOffset: 0,
            endOffset: 11,
            embedding: [0.1, 0.2],
          },
        ],
      };

      expect(cache.timestamp).toBeGreaterThan(0);
    });
  });
});
