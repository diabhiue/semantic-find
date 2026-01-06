// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// Find top K similar chunks
export function findTopKSimilar(
  queryEmbedding: number[],
  chunks: { embedding: number[]; [key: string]: unknown }[],
  k: number,
  threshold: number = 0
): { index: number; score: number }[] {
  const scores = chunks.map((chunk, index) => ({
    index,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return scores
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
