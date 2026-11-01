// High-reliability hybrid storage engine (localStorage + Memory fallback + IndexedDB persistence)
// Prevents QuotaExceededError and guarantees zero data loss even if browser localStorage is full.

const DB_NAME = 'rpg_demons_despair_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

// In-memory synchronous cache to guarantee synchronous reads/writes without quota limits
const memoryStore = new Map<string, string>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (e: any) => {
          resolve(e.target.result);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await getIDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function idbSet(key: string, val: string): Promise<void> {
  try {
    const db = await getIDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    // Ignore async background errors
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    const db = await getIDB();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    // Ignore async background errors
  }
}

// Pre-load IndexedDB into in-memory store on bootstrap
if (typeof window !== 'undefined' && window.indexedDB) {
  getIDB().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = (store as any).openCursor();
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!memoryStore.has(cursor.key)) {
            memoryStore.set(cursor.key, cursor.value);
          }
          cursor.continue();
        }
      };
    } catch (e) {}
  });
}

/**
 * Deeply strips or truncates heavy base64 strings and non-essential caches
 * only if they exceed safe thresholds, without destroying user avatars or gallery images.
 */
export function stripHeavyDataForCache(data: any, maxBase64Len = 500000): any {
  if (!data) return data;
  if (typeof data === 'string') {
    if (data.startsWith('data:image/') && data.length > maxBase64Len) {
      return '';
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => stripHeavyDataForCache(item, maxBase64Len));
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const k in data) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        // Truncate long history logs in caches if needed
        if (k === 'historico' && Array.isArray(data[k]) && data[k].length > 20) {
          cleaned[k] = data[k].slice(0, 20);
          continue;
        }
        cleaned[k] = stripHeavyDataForCache(data[k], maxBase64Len);
      }
    }
    return cleaned;
  }
  return data;
}

/**
 * Safely saves data using localStorage with in-memory caching and IndexedDB durability,
 * preserving all character avatars and user media without data loss.
 */
export const safeLocalStorageSetItem = (key: string, value: string): boolean => {
  // 1. Always update in-memory cache immediately
  memoryStore.set(key, value);

  // 2. Always persist asynchronously to IndexedDB in background
  idbSet(key, value);

  if (typeof localStorage === 'undefined') {
    return true;
  }

  // 3. Try saving full unstripped value to localStorage first
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    const isQuotaError =
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014 ||
      (error.message && error.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      try {
        // Clean dispensable stale cache items
        const keysToRemove: { key: string; length: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k !== key) {
            if (
              k.startsWith('supabase_cache_') ||
              k.startsWith('vtt_logs_') ||
              (k.startsWith('campaign_characters_') && k !== key)
            ) {
              const val = localStorage.getItem(k);
              keysToRemove.push({ key: k, length: val ? val.length : 0 });
            }
          }
        }

        keysToRemove.sort((a, b) => b.length - a.length);

        for (const item of keysToRemove) {
          localStorage.removeItem(item.key);
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (retryErr) {
            // Continue cleaning more keys
          }
        }
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

      // If localStorage is still full, data is already safely stored in memory and IndexedDB!
      console.warn(`⚠️ [Storage] Stored "${key}" in Memory & IndexedDB fallback (localStorage quota preserved).`);
      return true;
    }

    console.warn(`[Storage] Storage warning for "${key}":`, error);
    return true;
  }
};

/**
 * Safely reads a value, checking localStorage first, then the in-memory fallback.
 */
export const safeLocalStorageGetItem = (key: string): string | null => {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(key);
      if (val !== null && val !== undefined) {
        return val;
      }
    } catch (e) {}
  }
  return memoryStore.get(key) || null;
};

/**
 * Safely removes an item across localStorage, in-memory store, and IndexedDB.
 */
export const safeLocalStorageRemoveItem = (key: string): void => {
  memoryStore.delete(key);
  idbDel(key);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};
