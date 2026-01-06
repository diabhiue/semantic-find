/**
 * @jest-environment jsdom
 */

import {
  highlightText,
  removeHighlight,
  clearAllHighlights,
  setActiveHighlight,
  getHighlightCount
} from '../src/content/highlighter';

describe('Highlighter', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    clearAllHighlights();
  });

  describe('highlightText', () => {
    it('should return false when text is not found in DOM', () => {
      document.body.innerHTML = '<p>Hello world</p>';

      const result = highlightText('chunk-1', 'nonexistent text');

      expect(result).toBe(false);
    });

    it('should return false for very short search text', () => {
      document.body.innerHTML = '<p>ab</p>';

      const result = highlightText('chunk-1', 'ab');

      expect(result).toBe(false);
    });

    it('should highlight matching text', () => {
      document.body.innerHTML = '<p>This is a test paragraph with some content</p>';

      const result = highlightText('chunk-1', 'test paragraph with');

      expect(result).toBe(true);
      expect(getHighlightCount()).toBe(1);
    });

    it('should add correct CSS class to highlights', () => {
      document.body.innerHTML = '<p>This is test content here</p>';

      highlightText('chunk-1', 'test content');

      const highlight = document.querySelector('.semantic-find-highlight');
      expect(highlight).not.toBeNull();
    });
  });

  describe('removeHighlight', () => {
    it('should remove highlight by chunk ID', () => {
      document.body.innerHTML = '<p>Some test content to highlight</p>';
      highlightText('chunk-1', 'test content');

      expect(getHighlightCount()).toBe(1);

      removeHighlight('chunk-1');

      expect(getHighlightCount()).toBe(0);
    });

    it('should not throw when removing non-existent highlight', () => {
      expect(() => removeHighlight('non-existent')).not.toThrow();
    });
  });

  describe('clearAllHighlights', () => {
    it('should remove all highlights', () => {
      document.body.innerHTML = `
        <p>First test paragraph content</p>
        <p>Second test paragraph content</p>
      `;

      highlightText('chunk-1', 'first test paragraph');
      highlightText('chunk-2', 'second test paragraph');

      clearAllHighlights();

      expect(getHighlightCount()).toBe(0);
      expect(document.querySelectorAll('.semantic-find-highlight').length).toBe(0);
    });
  });

  describe('setActiveHighlight', () => {
    it('should add active class to highlighted element', () => {
      document.body.innerHTML = '<p>Test content for activation</p>';
      highlightText('chunk-1', 'test content');

      setActiveHighlight('chunk-1');

      const active = document.querySelector('.semantic-find-highlight-active');
      expect(active).not.toBeNull();
    });

    it('should remove active class from previous highlight', () => {
      document.body.innerHTML = `
        <p>First test content here</p>
        <p>Second test content here</p>
      `;

      highlightText('chunk-1', 'first test content');
      highlightText('chunk-2', 'second test content');

      setActiveHighlight('chunk-1');
      setActiveHighlight('chunk-2');

      const activeHighlights = document.querySelectorAll('.semantic-find-highlight-active');
      expect(activeHighlights.length).toBe(1);
    });

    it('should not throw for non-existent chunk', () => {
      expect(() => setActiveHighlight('non-existent')).not.toThrow();
    });
  });

  describe('getHighlightCount', () => {
    it('should return 0 initially', () => {
      expect(getHighlightCount()).toBe(0);
    });

    it('should return correct count after highlighting', () => {
      document.body.innerHTML = `
        <p>First paragraph content text</p>
        <p>Second paragraph content text</p>
        <p>Third paragraph content text</p>
      `;

      highlightText('chunk-1', 'first paragraph content');
      highlightText('chunk-2', 'second paragraph content');

      expect(getHighlightCount()).toBe(2);
    });
  });
});
