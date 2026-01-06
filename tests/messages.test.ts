import type {
  Message,
  GetEmbeddingsRequest,
  SearchQueryRequest,
  GetSettingsRequest,
  GenerateSummaryRequest,
} from '../src/shared/messages';

describe('Message Types', () => {
  describe('GetEmbeddingsRequest', () => {
    it('should have correct structure', () => {
      const request: GetEmbeddingsRequest = {
        type: 'GET_EMBEDDINGS',
        chunks: [
          { id: '1', text: 'Test', startOffset: 0, endOffset: 4 },
        ],
        url: 'https://example.com',
      };

      expect(request.type).toBe('GET_EMBEDDINGS');
      expect(request.chunks).toHaveLength(1);
      expect(request.url).toBe('https://example.com');
    });
  });

  describe('SearchQueryRequest', () => {
    it('should have correct structure', () => {
      const request: SearchQueryRequest = {
        type: 'SEARCH_QUERY',
        query: 'test query',
        chunks: [],
      };

      expect(request.type).toBe('SEARCH_QUERY');
      expect(request.query).toBe('test query');
    });
  });

  describe('GetSettingsRequest', () => {
    it('should have correct structure', () => {
      const request: GetSettingsRequest = {
        type: 'GET_SETTINGS',
      };

      expect(request.type).toBe('GET_SETTINGS');
    });
  });

  describe('GenerateSummaryRequest', () => {
    it('should have correct structure', () => {
      const request: GenerateSummaryRequest = {
        type: 'GENERATE_SUMMARY',
        query: 'What is this about?',
        topResults: [
          {
            chunk: { id: '1', text: 'Test', startOffset: 0, endOffset: 4 },
            score: 0.9,
            highlighted: false,
          },
        ],
      };

      expect(request.type).toBe('GENERATE_SUMMARY');
      expect(request.topResults).toHaveLength(1);
    });
  });

  describe('Message union type', () => {
    it('should accept valid message types', () => {
      const messages: Message[] = [
        { type: 'GET_MODEL_STATUS' },
        { type: 'GET_SETTINGS' },
        { type: 'GET_LLM_STATUS' },
        { type: 'DOWNLOAD_LLM' },
        { type: 'TOGGLE_OVERLAY' },
      ];

      expect(messages).toHaveLength(5);
      messages.forEach(msg => {
        expect(msg.type).toBeDefined();
      });
    });
  });
});
