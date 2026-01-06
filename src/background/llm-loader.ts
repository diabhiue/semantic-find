import { CreateMLCEngine, type MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import type { LLMStatus } from '../shared/types';

// SmolLM2 is tiny (~350MB) and fast - great for MacBook Air
const LLM_MODEL = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

let engine: MLCEngine | null = null;
let llmStatus: LLMStatus = 'not_downloaded';
let downloadProgress = 0;

type ProgressCallback = (progress: number) => void;
let progressCallback: ProgressCallback | null = null;

export function setLLMProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

export function getLLMStatus(): { status: LLMStatus; progress: number } {
  return { status: llmStatus, progress: downloadProgress };
}

export async function downloadAndInitLLM(): Promise<boolean> {
  if (engine && llmStatus === 'ready') {
    return true;
  }

  if (llmStatus === 'downloading') {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (llmStatus === 'ready') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (llmStatus === 'error') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  try {
    llmStatus = 'downloading';
    downloadProgress = 0;

    console.log('[SemanticFind] Downloading LLM model:', LLM_MODEL);

    const progressHandler = (report: InitProgressReport) => {
      downloadProgress = report.progress * 100;
      progressCallback?.(downloadProgress);
      console.log('[SemanticFind] LLM download progress:', report.text);
    };

    engine = await CreateMLCEngine(LLM_MODEL, {
      initProgressCallback: progressHandler,
    });

    llmStatus = 'ready';
    downloadProgress = 100;
    console.log('[SemanticFind] LLM model loaded successfully');
    return true;
  } catch (error) {
    console.error('[SemanticFind] Failed to load LLM model:', error);
    llmStatus = 'error';
    engine = null;
    return false;
  }
}

export async function generateSummary(query: string, contextTexts: string[]): Promise<string | null> {
  if (!engine || llmStatus !== 'ready') {
    console.error('[SemanticFind] LLM not ready for summary generation');
    return null;
  }

  try {
    llmStatus = 'generating';

    const context = contextTexts.slice(0, 5).join('\n\n---\n\n');
    const prompt = `Based on the following text excerpts, provide a brief summary that answers the query: "${query}"

Text excerpts:
${context}

Provide a concise summary in 2-3 sentences:`;

    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes text excerpts based on user queries. Be concise and direct.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    llmStatus = 'ready';
    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[SemanticFind] Failed to generate summary:', error);
    llmStatus = 'ready';
    return null;
  }
}

export function isLLMReady(): boolean {
  return engine !== null && llmStatus === 'ready';
}
