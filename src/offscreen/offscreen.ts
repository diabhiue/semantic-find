// Offscreen document for ML inference
// Service workers can't use URL.createObjectURL, so we run Transformers.js here

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';
import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';

// Configure transformers.js for Chrome extension environment
env.allowLocalModels = false;
env.useBrowserCache = true;

// Disable multi-threading to avoid blob worker CSP issues
env.backends.onnx.wasm.numThreads = 1;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const LLM_MODEL = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isLoading = false;

let loadProgress = 0;
let loadStatus = '';

// LLM state
let llmEngine: MLCEngine | null = null;
let llmIsLoading = false;
let llmProgress = 0;
let llmStatus: 'not_downloaded' | 'downloading' | 'ready' | 'error' = 'not_downloaded';

async function loadModel(): Promise<boolean> {
  if (embeddingPipeline) return true;
  if (isLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (embeddingPipeline) {
          clearInterval(check);
          resolve(true);
        }
      }, 100);
    });
  }

  try {
    isLoading = true;
    loadProgress = 0;
    loadStatus = 'downloading';
    console.log('[Offscreen] Loading model:', EMBEDDING_MODEL);

    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      progress_callback: (data: { progress?: number; status?: string; file?: string }) => {
        loadProgress = Math.round((data.progress || 0) * 100);
        loadStatus = data.file ? `Downloading ${data.file}` : 'downloading';
        chrome.runtime.sendMessage({
          type: 'MODEL_PROGRESS',
          progress: loadProgress,
          status: loadStatus,
        });
        console.log('[Offscreen] Progress:', loadProgress + '%', loadStatus);
      },
    });

    isLoading = false;
    loadProgress = 100;
    loadStatus = 'ready';
    chrome.runtime.sendMessage({
      type: 'MODEL_PROGRESS',
      progress: 100,
      status: 'ready',
    });
    console.log('[Offscreen] Model loaded successfully');
    return true;
  } catch (error) {
    console.error('[Offscreen] Failed to load model:', error);
    isLoading = false;
    loadStatus = 'error';
    return false;
  }
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingPipeline) {
    const loaded = await loadModel();
    if (!loaded) return null;
  }

  try {
    const output = await embeddingPipeline!(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data as Float32Array);
  } catch (error) {
    console.error('[Offscreen] Embedding error:', error);
    return null;
  }
}

async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingPipeline) {
    const loaded = await loadModel();
    if (!loaded) return texts.map(() => null);
  }

  const results: (number[] | null)[] = [];
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
}

// LLM functions
async function loadLLM(): Promise<boolean> {
  if (llmEngine) return true;
  if (llmIsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (llmEngine) {
          clearInterval(check);
          resolve(true);
        } else if (llmStatus === 'error') {
          clearInterval(check);
          resolve(false);
        }
      }, 100);
    });
  }

  try {
    llmIsLoading = true;
    llmStatus = 'downloading';
    llmProgress = 0;
    console.log('[Offscreen] Loading LLM:', LLM_MODEL);

    chrome.runtime.sendMessage({
      type: 'LLM_PROGRESS',
      progress: 0,
      status: 'downloading',
    });

    llmEngine = await CreateMLCEngine(LLM_MODEL, {
      initProgressCallback: (progress) => {
        llmProgress = Math.round(progress.progress * 100);
        chrome.runtime.sendMessage({
          type: 'LLM_PROGRESS',
          progress: llmProgress,
          status: 'downloading',
          text: progress.text,
        });
        console.log('[Offscreen] LLM Progress:', llmProgress + '%', progress.text);
      },
    });

    llmIsLoading = false;
    llmStatus = 'ready';
    llmProgress = 100;
    chrome.runtime.sendMessage({
      type: 'LLM_PROGRESS',
      progress: 100,
      status: 'ready',
    });
    console.log('[Offscreen] LLM loaded successfully');
    return true;
  } catch (error) {
    console.error('[Offscreen] Failed to load LLM:', error);
    llmIsLoading = false;
    llmStatus = 'error';
    chrome.runtime.sendMessage({
      type: 'LLM_PROGRESS',
      progress: 0,
      status: 'error',
    });
    return false;
  }
}

async function generateSummary(query: string, topResults: { text: string; score: number }[]): Promise<string | null> {
  if (!llmEngine) {
    const loaded = await loadLLM();
    if (!loaded) return null;
  }

  try {
    // Build context from top results - limit each chunk and total context
    const context = topResults
      .slice(0, 3)
      .map((r, i) => {
        // Truncate each result to ~200 chars to avoid overwhelming the model
        const text = r.text.substring(0, 200).trim();
        return `[${i + 1}] ${text}`;
      })
      .join('\n');

    console.log('[Offscreen] Summary input - Query:', query);
    console.log('[Offscreen] Summary input - Context:', context);

    const prompt = `Answer this question based on the text below.

Question: ${query}

Text:
${context}

Answer in 1-2 sentences:`;

    console.log('[Offscreen] Full prompt:', prompt);

    const response = await llmEngine!.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Give brief, direct answers. Never repeat words or phrases.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 80,
      temperature: 0.7,
      frequency_penalty: 1.5,
      presence_penalty: 1.5,
    });

    const result = response.choices[0]?.message?.content || null;
    console.log('[Offscreen] Summary result:', result);

    // Post-process to remove any obvious repetition
    if (result) {
      const cleaned = removeRepetition(result);
      console.log('[Offscreen] Cleaned result:', cleaned);
      return cleaned;
    }

    return result;
  } catch (error) {
    console.error('[Offscreen] Summary generation error:', error);
    return null;
  }
}

// Remove repetitive phrases from output
function removeRepetition(text: string): string {
  // Split into words
  const words = text.split(/\s+/);
  if (words.length < 4) return text;

  // Detect repeated phrases (3+ words repeating)
  const result: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    // Check for 3-word phrase repetition
    if (i >= 2) {
      const phrase = words.slice(i - 2, i + 1).join(' ').toLowerCase();
      if (seen.has(phrase)) {
        // Skip this word, we're in a repetition loop
        continue;
      }
      seen.add(phrase);
    }
    result.push(words[i]);
  }

  // Also check if the result itself is very short or seems cut off
  const cleaned = result.join(' ').trim();

  // If we removed too much, return first sentence of original
  if (cleaned.length < 20 && text.length > 50) {
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    return firstSentence ? firstSentence[0].trim() : text.substring(0, 100).trim();
  }

  return cleaned;
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  (async () => {
    switch (message.action) {
      case 'LOAD_MODEL': {
        const success = await loadModel();
        sendResponse({ success });
        break;
      }
      case 'GENERATE_EMBEDDING': {
        const embedding = await generateEmbedding(message.text);
        sendResponse({ embedding });
        break;
      }
      case 'GENERATE_EMBEDDINGS': {
        const embeddings = await generateEmbeddings(message.texts);
        sendResponse({ embeddings });
        break;
      }
      case 'GET_STATUS': {
        sendResponse({
          status: embeddingPipeline ? 'ready' : isLoading ? 'loading' : 'idle',
          progress: loadProgress,
          statusText: loadStatus,
        });
        break;
      }
      case 'DOWNLOAD_LLM': {
        const success = await loadLLM();
        sendResponse({ success });
        break;
      }
      case 'GET_LLM_STATUS': {
        sendResponse({
          status: llmStatus,
          progress: llmProgress,
        });
        break;
      }
      case 'GENERATE_SUMMARY': {
        const summary = await generateSummary(message.query, message.topResults);
        sendResponse({ success: !!summary, summary });
        break;
      }
      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();

  return true; // Keep channel open for async response
});

// Auto-load model on start
loadModel();

console.log('[Offscreen] Document ready');
