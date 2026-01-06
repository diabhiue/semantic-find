import type { Settings } from '../shared/types';
import type { GetSettingsResponse, GetModelStatusResponse, GetLLMStatusResponse } from '../shared/messages';

// DOM Elements
const chunkSizeInput = document.getElementById('chunk-size') as HTMLInputElement;
const chunkSizeValue = document.getElementById('chunk-size-value') as HTMLSpanElement;
const similarityThresholdInput = document.getElementById('similarity-threshold') as HTMLInputElement;
const similarityThresholdValue = document.getElementById('similarity-threshold-value') as HTMLSpanElement;
const aiSummaryInput = document.getElementById('ai-summary') as HTMLInputElement;
const llmStatusEl = document.getElementById('llm-status') as HTMLDivElement;
const llmProgressBar = llmStatusEl.querySelector('.llm-progress-bar') as HTMLDivElement;
const llmStatusText = llmStatusEl.querySelector('.llm-status-text') as HTMLSpanElement;
const modelStatusIndicator = document.getElementById('model-status-indicator') as HTMLSpanElement;
const modelStatusText = document.getElementById('model-status-text') as HTMLSpanElement;
const modelProgressContainer = document.getElementById('model-progress-container') as HTMLDivElement;
const modelProgressFill = document.getElementById('model-progress-fill') as HTMLDivElement;
const modelProgressText = document.getElementById('model-progress-text') as HTMLSpanElement;

let currentSettings: Settings | null = null;

// Load settings
async function loadSettings(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }) as GetSettingsResponse;
  currentSettings = response.settings;

  // Update UI
  chunkSizeInput.value = String(currentSettings.chunkSize);
  chunkSizeValue.textContent = String(currentSettings.chunkSize);

  similarityThresholdInput.value = String(currentSettings.similarityThreshold);
  similarityThresholdValue.textContent = currentSettings.similarityThreshold.toFixed(2);

  aiSummaryInput.checked = currentSettings.aiSummaryEnabled;
}

// Save settings
async function saveSettings(updates: Partial<Settings>): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings: updates });
  if (currentSettings) {
    currentSettings = { ...currentSettings, ...updates };
  }
}

// Update model status
async function updateModelStatus(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' }) as GetModelStatusResponse & { statusText?: string };

  modelStatusIndicator.className = 'status-indicator';

  switch (response.status) {
    case 'idle':
      modelStatusIndicator.classList.add('loading');
      modelStatusText.textContent = 'Model not loaded yet';
      modelProgressContainer.style.display = 'none';
      break;
    case 'loading':
      modelStatusIndicator.classList.add('loading');
      modelStatusText.textContent = 'Downloading model...';
      modelProgressContainer.style.display = 'block';
      modelProgressFill.style.width = `${response.progress || 0}%`;
      modelProgressText.textContent = response.statusText || `${Math.round(response.progress || 0)}% complete`;
      break;
    case 'ready':
      modelStatusIndicator.classList.add('ready');
      modelStatusText.textContent = 'Model ready';
      modelProgressContainer.style.display = 'none';
      break;
    case 'error':
      modelStatusIndicator.classList.add('error');
      modelStatusText.textContent = 'Model failed to load';
      modelProgressContainer.style.display = 'none';
      break;
  }
}

// Update LLM status
async function updateLLMStatus(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_LLM_STATUS' }) as GetLLMStatusResponse;

  switch (response.status) {
    case 'downloading':
      llmStatusEl.classList.remove('hidden');
      llmProgressBar.style.width = `${response.progress || 0}%`;
      llmStatusText.textContent = `Downloading model... ${Math.round(response.progress || 0)}%`;
      break;
    case 'ready':
      llmStatusEl.classList.remove('hidden');
      llmProgressBar.style.width = '100%';
      llmStatusText.textContent = 'AI Summary model ready';
      break;
    case 'error':
      llmStatusEl.classList.remove('hidden');
      llmStatusText.textContent = 'Failed to download model';
      break;
    default:
      llmStatusEl.classList.add('hidden');
  }
}

// Download LLM
async function downloadLLM(): Promise<void> {
  llmStatusEl.classList.remove('hidden');
  llmStatusText.textContent = 'Starting download...';

  await chrome.runtime.sendMessage({ type: 'DOWNLOAD_LLM' });

  // Poll for status
  const pollInterval = setInterval(async () => {
    await updateLLMStatus();
    const response = await chrome.runtime.sendMessage({ type: 'GET_LLM_STATUS' }) as GetLLMStatusResponse;
    if (response.status === 'ready' || response.status === 'error') {
      clearInterval(pollInterval);
    }
  }, 500);
}

// Event listeners
chunkSizeInput.addEventListener('input', () => {
  const value = parseInt(chunkSizeInput.value, 10);
  chunkSizeValue.textContent = String(value);
  saveSettings({ chunkSize: value });
});

similarityThresholdInput.addEventListener('input', () => {
  const value = parseFloat(similarityThresholdInput.value);
  similarityThresholdValue.textContent = value.toFixed(2);
  saveSettings({ similarityThreshold: value });
});

aiSummaryInput.addEventListener('change', async () => {
  const enabled = aiSummaryInput.checked;
  await saveSettings({ aiSummaryEnabled: enabled });

  if (enabled && !currentSettings?.llmModelDownloaded) {
    // Download LLM model
    await downloadLLM();
  }
});

// Initialize
loadSettings();
updateModelStatus();
updateLLMStatus();

// Poll model status (faster during loading)
async function pollModelStatus() {
  await updateModelStatus();
  const response = await chrome.runtime.sendMessage({ type: 'GET_MODEL_STATUS' }) as GetModelStatusResponse;
  const interval = response.status === 'loading' ? 500 : 3000;
  setTimeout(pollModelStatus, interval);
}
pollModelStatus();
