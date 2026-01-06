/**
 * Capture a screenshot of the Semantic Find extension in action
 * Run with: node scripts/capture-screenshot.mjs
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, '../dist');
const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/Google';
const SCREENSHOT_PATH = path.join(__dirname, '../assets/demo.png');

async function captureScreenshot() {
  console.log('Launching browser with extension...');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log('Navigating to Wikipedia...');
  await page.goto(WIKIPEDIA_URL);
  await page.waitForLoadState('domcontentloaded');

  // Wait for extension to load
  console.log('Waiting for extension to load...');
  let attempts = 0;
  while (attempts < 30) {
    const hasOverlay = await page.evaluate(() => {
      return !!document.querySelector('#semantic-find-overlay');
    });
    if (hasOverlay) break;
    await page.waitForTimeout(500);
    attempts++;
  }

  // Open the search overlay
  console.log('Opening search overlay...');
  await page.keyboard.press('Alt+Shift+f');
  await page.waitForTimeout(500);

  // Check if overlay is visible, if not try to make it visible
  const isVisible = await page.evaluate(() => {
    const overlay = document.querySelector('#semantic-find-overlay');
    return overlay?.classList.contains('visible');
  });

  if (!isVisible) {
    await page.evaluate(() => {
      const overlay = document.querySelector('#semantic-find-overlay');
      if (overlay) {
        overlay.classList.add('visible');
        const input = document.querySelector('#sf-search-input');
        if (input) input.focus();
      }
    });
  }

  await page.waitForSelector('#semantic-find-overlay.visible', { timeout: 5000 });

  // Type a search query
  console.log('Typing search query...');
  const input = page.locator('#sf-search-input');
  await input.fill('CEO of Google');

  // Wait for results
  console.log('Waiting for search results (this may take a moment for model download)...');
  let resultCount = 0;
  const startTime = Date.now();
  const timeout = 120000; // 2 minutes for model download

  while (Date.now() - startTime < timeout) {
    const countText = await page.locator('#sf-result-count').textContent();
    if (countText && countText.includes(' of ')) {
      const match = countText.match(/(\d+) of (\d+)/);
      if (match) {
        resultCount = parseInt(match[2], 10);
        break;
      }
    }
    await page.waitForTimeout(1000);
  }

  console.log(`Found ${resultCount} results`);

  // Wait a bit for highlights to render
  await page.waitForTimeout(1000);

  // Take screenshot
  console.log(`Saving screenshot to ${SCREENSHOT_PATH}...`);
  await page.screenshot({
    path: SCREENSHOT_PATH,
    fullPage: false,
  });

  console.log('Screenshot captured successfully!');

  await context.close();
}

captureScreenshot().catch(console.error);
