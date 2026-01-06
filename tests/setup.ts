// Jest setup file - mock Chrome APIs and external dependencies
import '@jest/globals';

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Mock Chrome API
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  commands: {
    onCommand: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
    },
  },
};

(global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
};

(global as unknown as { indexedDB: typeof mockIndexedDB }).indexedDB = mockIndexedDB;

// Mock transformers.js
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
  env: {
    allowLocalModels: false,
    useBrowserCache: true,
  },
}));

// Mock web-llm
jest.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: jest.fn(),
}));
