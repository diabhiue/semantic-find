import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { ModelStatus } from '../shared/types';

// Configure transformers.js for browser/extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model to use - all-MiniLM-L6-v2 is fast and works well on MacBook Air
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let modelStatus: ModelStatus = 'idle';
let loadProgress = 0;

// Progress callback for model loading
type ProgressCallback = (progress: number) => void;
let progressCallback: ProgressCallback | null = null;

export function setProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

export function getModelStatus(): { status: ModelStatus; progress: number } {
  return { status: modelStatus, progress: loadProgress };
}

export async function loadEmbeddingModel(): Promise<boolean> {
  if (embeddingPipeline) {
    return true;
  }

  if (modelStatus === 'loading') {
    // Wait for existing load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (modelStatus === 'ready') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (modelStatus === 'error') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  try {
    modelStatus = 'loading';
    loadProgress = 0;

    console.log('[SemanticFind] Loading embedding model:', EMBEDDING_MODEL);

    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      progress_callback: (data: { progress?: number; status?: string }) => {
        if (data.progress !== undefined) {
          loadProgress = data.progress;
          progressCallback?.(loadProgress);
        }
        console.log('[SemanticFind] Model load progress:', data);
      },
    });

    modelStatus = 'ready';
    loadProgress = 100;
    console.log('[SemanticFind] Embedding model loaded successfully');
    return true;
  } catch (error) {
    console.error('[SemanticFind] Failed to load embedding model:', error);
    modelStatus = 'error';
    embeddingPipeline = null;
    return false;
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingPipeline) {
    const loaded = await loadEmbeddingModel();
    if (!loaded) {
      return null;
    }
  }

  try {
    const output = await embeddingPipeline!(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to regular array
    return Array.from(output.data as Float32Array);
  } catch (error) {
    console.error('[SemanticFind] Failed to generate embedding:', error);
    return null;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingPipeline) {
    const loaded = await loadEmbeddingModel();
    if (!loaded) {
      return texts.map(() => null);
    }
  }

  try {
    const results: (number[] | null)[] = [];

    // Process in batches to avoid memory issues
    const batchSize = 32;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const outputs = await Promise.all(
        batch.map(async (text) => {
          try {
            const output = await embeddingPipeline!(text, {
              pooling: 'mean',
              normalize: true,
            });
            return Array.from(output.data as Float32Array);
          } catch {
            return null;
          }
        })
      );
      results.push(...outputs);
    }

    return results;
  } catch (error) {
    console.error('[SemanticFind] Failed to generate embeddings:', error);
    return texts.map(() => null);
  }
}
