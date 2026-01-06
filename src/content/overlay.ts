import type { SearchResult, Settings } from '../shared/types';
import { createSummaryPanel, showSummary, showSummaryLoading, hideSummary } from './summary-panel';

// Overlay state
let overlay: HTMLElement | null = null;
let isVisible = false;
let currentResults: SearchResult[] = [];
let currentIndex = 0;
let settings: Settings | null = null;

type SearchCallback = (query: string) => void;
type NavigateCallback = (index: number) => void;
type CloseCallback = () => void;
type SummaryCallback = (query: string, results: SearchResult[]) => void;

let onSearch: SearchCallback | null = null;
let onNavigate: NavigateCallback | null = null;
let onClose: CloseCallback | null = null;
let onRequestSummary: SummaryCallback | null = null;

export function createOverlay(): HTMLElement {
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'semantic-find-overlay';
  overlay.innerHTML = `
    <div class="sf-container">
      <input type="text" id="sf-search-input" placeholder="Find" autocomplete="off" />
      <span class="sf-count" id="sf-result-count"></span>
      <span class="sf-status" id="sf-status"></span>
      <div class="sf-separator"></div>
      <button class="sf-nav-btn" id="sf-prev" title="Previous match (Shift+Enter)">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
        </svg>
      </button>
      <button class="sf-nav-btn" id="sf-next" title="Next match (Enter)">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
        </svg>
      </button>
      <div class="sf-separator"></div>
      <button class="sf-close-btn" id="sf-close" title="Close (Escape)">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
    <div id="sf-summary-container"></div>
  `;

  // Append summary panel
  const summaryContainer = overlay.querySelector('#sf-summary-container');
  if (summaryContainer) {
    summaryContainer.appendChild(createSummaryPanel());
  }

  // Event listeners
  const input = overlay.querySelector('#sf-search-input') as HTMLInputElement;
  const prevBtn = overlay.querySelector('#sf-prev') as HTMLButtonElement;
  const nextBtn = overlay.querySelector('#sf-next') as HTMLButtonElement;
  const closeBtn = overlay.querySelector('#sf-close') as HTMLButtonElement;

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  input.addEventListener('input', () => {
    // Debounce search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      const query = input.value.trim();
      if (query.length >= 2 && onSearch) {
        onSearch(query);
      } else if (query.length < 2) {
        updateResults([]);
      }
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigatePrev();
      } else {
        navigateNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  });

  prevBtn.addEventListener('click', navigatePrev);
  nextBtn.addEventListener('click', navigateNext);
  closeBtn.addEventListener('click', hide);

  // Prevent clicks inside overlay from propagating
  overlay.addEventListener('click', (e) => e.stopPropagation());

  document.body.appendChild(overlay);
  return overlay;
}

export function show(): void {
  if (!overlay) {
    createOverlay();
  }

  overlay!.classList.add('visible');
  isVisible = true;

  // Focus input after transition completes (visibility transition is 0.15s)
  const input = overlay!.querySelector('#sf-search-input') as HTMLInputElement;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  });
}

export function hide(): void {
  if (!overlay) return;

  overlay.classList.remove('visible');
  isVisible = false;
  hideSummary();

  onClose?.();
}

export function toggle(): void {
  if (isVisible) {
    hide();
  } else {
    show();
  }
}

export function isOverlayVisible(): boolean {
  return isVisible;
}

export function updateResults(results: SearchResult[]): void {
  currentResults = results;
  currentIndex = 0;

  const countEl = overlay?.querySelector('#sf-result-count');
  const statusEl = overlay?.querySelector('#sf-status');

  if (countEl) {
    if (results.length > 0) {
      countEl.textContent = `1 of ${results.length}`;
    } else {
      countEl.textContent = '';
    }
  }

  if (statusEl) {
    statusEl.textContent = '';
  }

  // Request summary if AI summary is enabled and we have results
  if (settings?.aiSummaryEnabled && results.length > 0 && onRequestSummary) {
    const input = overlay?.querySelector('#sf-search-input') as HTMLInputElement;
    const query = input?.value.trim() || '';
    if (query) {
      showSummaryLoading();
      onRequestSummary(query, results);
    }
  } else {
    hideSummary();
  }

  // Navigate to first result
  if (results.length > 0 && onNavigate) {
    onNavigate(0);
  }
}

export function updateSummary(summary: string): void {
  showSummary(summary);
}

export function setStatus(status: string): void {
  const statusEl = overlay?.querySelector('#sf-status');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

export function setSettings(newSettings: Settings): void {
  settings = newSettings;
}

function navigateNext(): void {
  if (currentResults.length === 0) return;

  currentIndex = (currentIndex + 1) % currentResults.length;
  updateNavigationUI();
  onNavigate?.(currentIndex);
}

function navigatePrev(): void {
  if (currentResults.length === 0) return;

  currentIndex = (currentIndex - 1 + currentResults.length) % currentResults.length;
  updateNavigationUI();
  onNavigate?.(currentIndex);
}

function updateNavigationUI(): void {
  const countEl = overlay?.querySelector('#sf-result-count');
  if (countEl && currentResults.length > 0) {
    countEl.textContent = `${currentIndex + 1} of ${currentResults.length}`;
  }
}

// Callback setters
export function setOnSearch(callback: SearchCallback): void {
  onSearch = callback;
}

export function setOnNavigate(callback: NavigateCallback): void {
  onNavigate = callback;
}

export function setOnClose(callback: CloseCallback): void {
  onClose = callback;
}

export function setOnRequestSummary(callback: SummaryCallback): void {
  onRequestSummary = callback;
}
