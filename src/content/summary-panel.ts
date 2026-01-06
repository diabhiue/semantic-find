// AI Summary panel component

let summaryPanel: HTMLElement | null = null;

export function createSummaryPanel(): HTMLElement {
  if (summaryPanel) {
    return summaryPanel;
  }

  summaryPanel = document.createElement('div');
  summaryPanel.id = 'semantic-find-summary-panel';
  summaryPanel.innerHTML = `
    <div class="sf-summary-content">
      <div class="sf-summary-text"></div>
    </div>
  `;

  return summaryPanel;
}

export function showSummary(text: string): void {
  if (!summaryPanel) return;

  const contentEl = summaryPanel.querySelector('.sf-summary-text');
  if (contentEl) {
    contentEl.textContent = text;
  }

  summaryPanel.classList.add('visible');
}

export function showSummaryLoading(): void {
  if (!summaryPanel) return;

  const contentEl = summaryPanel.querySelector('.sf-summary-text');
  if (contentEl) {
    contentEl.innerHTML = '<span class="sf-summary-loading">Generating summary...</span>';
  }

  summaryPanel.classList.add('visible');
}

export function hideSummary(): void {
  if (!summaryPanel) return;
  summaryPanel.classList.remove('visible');
}

export function getSummaryPanel(): HTMLElement | null {
  return summaryPanel;
}
