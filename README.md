# Semantic Find

A Chrome extension that provides semantic search - like Ctrl+F but with AI-powered meaning-based matching. Everything runs locally in your browser.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)

## Features

- **Semantic Search**: Find content by meaning, not just exact text matches
- **Chrome-Style UI**: Familiar Ctrl+F look and feel
- **Keyboard Shortcut**: Press `Ctrl+Shift+F` (Mac: `Cmd+Shift+F`) to open
- **100% Local**: All AI processing happens in your browser - no data sent to servers
- **Fast**: WebGPU acceleration with WASM fallback
- **Smart Caching**: Instant results on revisited pages
- **Native Highlighting**: Uses CSS Custom Highlight API for smooth, non-intrusive highlights
- **AI Summary** (optional): Get LLM-powered summaries of search results

## Installation

### From Chrome Web Store
Coming soon!

### Manual Installation (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/semantic-find.git
   cd semantic-find
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac) on any webpage
2. Type your search query (searches by meaning, not exact match)
3. Use `Enter` / `Shift+Enter` or arrow buttons to navigate results
4. Press `Escape` to close

### Settings

Click the extension icon to access settings:
- **Chunk Size**: Adjust text segmentation (smaller = more precise)
- **Similarity Threshold**: Filter results by relevance score
- **AI Summary**: Enable LLM-powered summaries (downloads ~350MB model)

## How It Works

Semantic Find uses local AI models to understand the meaning of text:

1. **Text Extraction**: Extracts visible text from the page, intelligently filtering out navigation, sidebars, and other non-content elements
2. **Chunking**: Splits text into semantic segments using sentence boundaries
3. **Embeddings**: Converts text to vector representations using [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (~25MB)
4. **Similarity Search**: Finds chunks semantically similar to your query using cosine similarity
5. **Highlighting**: Uses [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) for native-like text highlighting
6. **AI Summary** (optional): Uses [SmolLM2-360M](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) to summarize results

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Content Script (per page)                                   │
│  ├── Extracts page text content                             │
│  ├── Chunks text into segments                              │
│  ├── Injects search overlay UI                              │
│  └── Highlights matching text (CSS Custom Highlight API)    │
├─────────────────────────────────────────────────────────────┤
│  Offscreen Document (background processing)                  │
│  ├── Loads embedding model (Transformers.js)                │
│  ├── Loads LLM for summaries (WebLLM)                       │
│  ├── Computes embeddings (WebGPU → WASM fallback)           │
│  └── Generates AI summaries                                  │
├─────────────────────────────────────────────────────────────┤
│  Service Worker (message routing)                            │
│  ├── Routes messages between components                      │
│  ├── Manages offscreen document lifecycle                   │
│  └── Handles keyboard shortcut                               │
├─────────────────────────────────────────────────────────────┤
│  Popup (settings UI)                                         │
│  ├── Chunk size configuration                               │
│  ├── Similarity threshold slider                            │
│  └── AI Summary toggle                                       │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
semantic-find/
├── manifest.json              # Chrome Extension Manifest V3
├── package.json               # Dependencies and scripts
├── webpack.config.js          # Build configuration
├── playwright.config.ts       # E2E test configuration
├── jest.config.js             # Unit test configuration
├── tsconfig.json              # TypeScript configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Message routing, offscreen management
│   ├── content/
│   │   ├── content-script.ts  # Main content script entry
│   │   ├── text-chunker.ts    # Smart text segmentation
│   │   ├── highlighter.ts     # CSS Custom Highlight API integration
│   │   ├── overlay.ts         # Search UI overlay (Chrome-style)
│   │   └── summary-panel.ts   # AI summary display panel
│   ├── offscreen/
│   │   ├── offscreen.html     # Offscreen document HTML
│   │   └── offscreen.ts       # Embedding & LLM processing
│   ├── popup/
│   │   ├── popup.html         # Settings popup HTML
│   │   ├── popup.ts           # Settings logic
│   │   └── popup.css          # Settings styles
│   ├── shared/
│   │   ├── types.ts           # TypeScript type definitions
│   │   └── similarity.ts      # Cosine similarity calculation
│   └── styles/
│       └── overlay.css        # Chrome-style search bar CSS
├── e2e/
│   └── semantic-search.spec.ts # End-to-end Playwright tests
├── tests/
│   ├── similarity.test.ts     # Unit tests for similarity
│   └── text-chunker.test.ts   # Unit tests for text chunking
└── public/
    └── icons/                 # Extension icons
```

## Development

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# Clean build artifacts
npm run clean
```

## Testing

### Unit Tests

Unit tests use Jest with jsdom for DOM testing:

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### End-to-End Tests

E2E tests use Playwright to test the extension on real web pages (Wikipedia):

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run E2E tests (headless)
npm run test:e2e

# Run E2E tests with browser visible
npm run test:e2e:headed

# Run E2E tests in debug mode
npm run test:e2e:debug
```

**Note**: E2E tests require a built extension (`npm run build` first) and run against the Wikipedia Google page to verify:
- Extension loads correctly
- Search overlay opens with keyboard shortcut
- Semantic search returns relevant results
- Text highlighting works
- Navigation between results works
- Overlay closes on Escape

## Technologies

- **[Transformers.js](https://huggingface.co/docs/transformers.js)** - Browser ML framework using ONNX Runtime
- **[WebLLM](https://github.com/mlc-ai/web-llm)** - Run LLMs in browser with WebGPU
- **[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)** - Native text highlighting
- **TypeScript** - Type-safe development
- **Webpack** - Module bundling
- **Playwright** - E2E testing
- **Jest** - Unit testing

## Privacy

This extension is designed with privacy in mind:
- All AI processing happens locally in your browser
- No data is sent to external servers
- Page content is never transmitted
- Embeddings are cached locally in IndexedDB

## Requirements

- Chrome 124+ (for WebGPU in service workers)
- ~25MB for embedding model (downloaded once)
- ~350MB for AI summary model (optional, downloaded when enabled)

## Troubleshooting

### Extension not loading
- Ensure you're using Chrome 124 or later
- Check that the `dist` folder exists after running `npm run build`
- Look for errors in `chrome://extensions/`

### Slow first search
- First search on a page requires indexing (1-3 seconds)
- Subsequent searches on the same page are instant (cached)
- Model download happens once on first use (~25MB)

### AI Summary not working
- Enable AI Summary in extension settings first
- Wait for model download to complete (~350MB)
- Check browser console for WebGPU errors

## Credits

This extension was built with the assistance of **[Claude](https://claude.ai)** by Anthropic, using **[Claude Code](https://claude.com/claude-code)** - an AI-powered coding assistant. Claude helped with:
- Architecture design and implementation planning
- TypeScript code implementation
- CSS Custom Highlight API integration for native-like text highlighting
- WebLLM integration for AI summaries
- Playwright E2E test suite development
- Chrome-style UI design matching Ctrl+F

Special thanks to:
- [Hugging Face](https://huggingface.co/) for Transformers.js and the embedding models
- [MLC AI](https://github.com/mlc-ai) for WebLLM
- The Chromium team for the CSS Custom Highlight API

## License

MIT
