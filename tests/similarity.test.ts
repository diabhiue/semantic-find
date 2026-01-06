import { cosineSimilarity, findTopKSimilar } from '../src/shared/similarity';

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const vector = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('should handle normalized vectors', () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    const expected = 0.6 * 0.8 + 0.8 * 0.6; // 0.96
    expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
  });

  it('should return 0 when one vector is all zeros', () => {
    const a = [1, 2, 3];
    const b = [0, 0, 0];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should throw error for vectors of different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have the same length');
  });

  it('should handle single-element vectors', () => {
    expect(cosineSimilarity([5], [5])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([5], [-5])).toBeCloseTo(-1, 5);
  });

  it('should handle large vectors', () => {
    const size = 384; // Typical embedding size
    const a = Array(size).fill(0).map((_, i) => Math.sin(i));
    const b = Array(size).fill(0).map((_, i) => Math.cos(i));
    const result = cosineSimilarity(a, b);
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe('findTopKSimilar', () => {
  const chunks = [
    { id: '1', embedding: [1, 0, 0] },
    { id: '2', embedding: [0, 1, 0] },
    { id: '3', embedding: [0.9, 0.1, 0] },
    { id: '4', embedding: [0.5, 0.5, 0] },
    { id: '5', embedding: [-1, 0, 0] },
  ];

  it('should find top K most similar chunks', () => {
    const query = [1, 0, 0];
    const results = findTopKSimilar(query, chunks, 3);

    expect(results).toHaveLength(3);
    expect(results[0].index).toBe(0); // Exact match
    expect(results[0].score).toBeCloseTo(1, 5);
  });

  it('should respect threshold parameter', () => {
    const query = [1, 0, 0];
    const results = findTopKSimilar(query, chunks, 10, 0.8);

    // Only chunks with score >= 0.8
    expect(results.every(r => r.score >= 0.8)).toBe(true);
  });

  it('should return empty array when no matches above threshold', () => {
    const query = [0, 0, 1]; // Orthogonal to all chunks
    const results = findTopKSimilar(query, chunks, 3, 0.5);

    expect(results).toHaveLength(0);
  });

  it('should sort results by score descending', () => {
    const query = [1, 0, 0];
    const results = findTopKSimilar(query, chunks, 5);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should limit results to K', () => {
    const query = [0.5, 0.5, 0];
    const results = findTopKSimilar(query, chunks, 2);

    expect(results).toHaveLength(2);
  });

  it('should handle empty chunks array', () => {
    const query = [1, 0, 0];
    const results = findTopKSimilar(query, [], 3);

    expect(results).toHaveLength(0);
  });
});
