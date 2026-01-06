/**
 * @jest-environment jsdom
 */

import { chunkText } from '../src/content/text-chunker';

describe('chunkText', () => {
  it('should chunk text into segments of target size', () => {
    const textNodes = [
      { text: 'Hello world', node: {} as Node, startOffset: 0 },
      { text: 'This is a test', node: {} as Node, startOffset: 12 },
      { text: 'Another segment here', node: {} as Node, startOffset: 27 },
    ];

    const chunks = chunkText(textNodes, 30);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach(chunk => {
      expect(chunk.text.length).toBeLessThanOrEqual(50); // Allow some overflow
    });
  });

  it('should create unique IDs for each chunk', () => {
    const textNodes = [
      { text: 'First text', node: {} as Node, startOffset: 0 },
      { text: 'Second text', node: {} as Node, startOffset: 11 },
      { text: 'Third text', node: {} as Node, startOffset: 23 },
    ];

    const chunks = chunkText(textNodes, 15);
    const ids = chunks.map(c => c.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should preserve text content', () => {
    const textNodes = [
      { text: 'Hello', node: {} as Node, startOffset: 0 },
      { text: 'World', node: {} as Node, startOffset: 6 },
    ];

    const chunks = chunkText(textNodes, 100);
    const allText = chunks.map(c => c.text).join(' ');

    expect(allText).toContain('Hello');
    expect(allText).toContain('World');
  });

  it('should handle empty input', () => {
    const chunks = chunkText([], 200);
    expect(chunks).toHaveLength(0);
  });

  it('should handle single text node', () => {
    const textNodes = [
      { text: 'Single text node', node: {} as Node, startOffset: 0 },
    ];

    const chunks = chunkText(textNodes, 200);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Single text node');
  });

  it('should set correct offsets', () => {
    const textNodes = [
      { text: 'First', node: {} as Node, startOffset: 0 },
      { text: 'Second', node: {} as Node, startOffset: 6 },
    ];

    const chunks = chunkText(textNodes, 100);

    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBeGreaterThan(0);
  });

  it('should split long texts into multiple chunks', () => {
    // Create multiple text nodes that together exceed target size
    const textNodes = [
      { text: 'This is a very long text', node: {} as Node, startOffset: 0 },
      { text: 'that should be split into multiple chunks', node: {} as Node, startOffset: 25 },
      { text: 'because it exceeds the target size', node: {} as Node, startOffset: 67 },
      { text: 'significantly and needs processing', node: {} as Node, startOffset: 102 },
    ];

    const chunks = chunkText(textNodes, 50);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not split words', () => {
    const textNodes = [
      { text: 'Hello', node: {} as Node, startOffset: 0 },
      { text: 'beautiful', node: {} as Node, startOffset: 6 },
      { text: 'world', node: {} as Node, startOffset: 16 },
    ];

    const chunks = chunkText(textNodes, 10);

    // Each chunk should contain complete words
    chunks.forEach(chunk => {
      const words = chunk.text.split(' ');
      words.forEach(word => {
        expect(['Hello', 'beautiful', 'world']).toContain(word);
      });
    });
  });
});
