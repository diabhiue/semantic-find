import type { TextChunk, PageCache } from '../shared/types';

const DB_NAME = 'SemanticFindDB';
const DB_VERSION = 1;
const STORE_NAME = 'pageEmbeddings';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[SemanticFind] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function getCachedEmbeddings(url: string): Promise<TextChunk[] | null> {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as PageCache | undefined;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache is still valid
        if (Date.now() - result.timestamp > CACHE_MAX_AGE) {
          // Cache expired, delete it
          deleteCache(url);
          resolve(null);
          return;
        }

        resolve(result.chunks);
      };
    });
  } catch (error) {
    console.error('[SemanticFind] Failed to get cached embeddings:', error);
    return null;
  }
}

export async function cacheEmbeddings(url: string, chunks: TextChunk[]): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const cache: PageCache = {
        url,
        timestamp: Date.now(),
        chunks,
      };

      const request = store.put(cache);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[SemanticFind] Failed to cache embeddings:', error);
  }
}

async function deleteCache(url: string): Promise<void> {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(url);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[SemanticFind] Failed to delete cache:', error);
  }
}

export async function clearOldCache(): Promise<void> {
  try {
    const database = await openDB();
    const cutoff = Date.now() - CACHE_MAX_AGE;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('[SemanticFind] Failed to clear old cache:', error);
  }
}
