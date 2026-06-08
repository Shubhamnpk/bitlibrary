const DB_NAME = 'app-runtime-v1';
const DB_STORE = 'records';
const KEY_ID = 'default';
const PREVIOUS_DB_NAME = 'bitlibrary-private-storage-v1';
const PREVIOUS_DB_STORE = 'keys';
const PREVIOUS_KEY_ID = 'local-storage';
const ENCRYPTED_STORAGE_VERSION = 1;
const ENCRYPTED_ALGORITHM = 'AES-GCM';
const STORAGE_PRIVACY_SEED = import.meta.env.VITE_STORAGE_PRIVACY_SEED || 'bitlibrary-storage-privacy-v1';
const MANAGED_STORAGE_KEYS = [
  'bitlibrary-user-state-v1',
  'bitlibrary-reader-state-v1',
  'bitlibrary-api-cache-v1',
  'bitlibrary-page-cache-v1',
];
const MANAGED_STORAGE_KEY_SET = new Set(MANAGED_STORAGE_KEYS);

interface EncryptedEnvelope {
  v: number;
  i: string;
  d: string;
  t: number;
}

interface LegacyEncryptedEnvelope {
  v: number;
  alg: typeof ENCRYPTED_ALGORITHM;
  iv: string;
  data: string;
  updatedAt: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const decryptedValues = new Map<string, string>();
let storageKeyPromise: Promise<CryptoKey | null> | null = null;
let initialized = false;

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' &&
  Boolean(window.localStorage) &&
  Boolean(window.crypto?.subtle) &&
  Boolean(window.indexedDB)
);

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const isEncryptedStorageEnvelope = (value: string | null): boolean => {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedEnvelope & LegacyEncryptedEnvelope>;
    return parsed.v === ENCRYPTED_STORAGE_VERSION && (
      (typeof parsed.i === 'string' && typeof parsed.d === 'string') ||
      (parsed.alg === ENCRYPTED_ALGORITHM && typeof parsed.iv === 'string' && typeof parsed.data === 'string')
    );
  } catch {
    return false;
  }
};

const openDatabase = (name: string, storeName: string) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = window.indexedDB.open(name, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(storeName)) {
      request.result.createObjectStore(storeName);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readStoredKey = (db: IDBDatabase, storeName: string, keyId: string) => new Promise<CryptoKey | null>((resolve, reject) => {
  if (!db.objectStoreNames.contains(storeName)) {
    resolve(null);
    return;
  }

  const transaction = db.transaction(storeName, 'readonly');
  const request = transaction.objectStore(storeName).get(keyId);
  request.onsuccess = () => resolve(request.result as CryptoKey | null);
  request.onerror = () => reject(request.error);
});

const writeStoredKey = (db: IDBDatabase, key: CryptoKey) => new Promise<void>((resolve, reject) => {
  const transaction = db.transaction(DB_STORE, 'readwrite');
  const request = transaction.objectStore(DB_STORE).put(key, KEY_ID);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

const deletePreviousKeyDatabase = () => {
  try {
    window.indexedDB.deleteDatabase(PREVIOUS_DB_NAME);
  } catch {
    // Best effort cleanup of older descriptive IndexedDB names.
  }
};

const readPreviousStoredKey = async () => {
  try {
    const db = await openDatabase(PREVIOUS_DB_NAME, PREVIOUS_DB_STORE);
    try {
      return await readStoredKey(db, PREVIOUS_DB_STORE, PREVIOUS_KEY_ID);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
};

const getStorageKey = async () => {
  if (!isBrowserStorageAvailable()) return null;
  const db = await openDatabase(DB_NAME, DB_STORE);
  try {
    const existingKey = await readStoredKey(db, DB_STORE, KEY_ID);
    if (existingKey) return existingKey;

    const previousKey = await readPreviousStoredKey();
    if (previousKey) {
      await writeStoredKey(db, previousKey);
      deletePreviousKeyDatabase();
      return previousKey;
    }

    const key = await window.crypto.subtle.generateKey(
      { name: ENCRYPTED_ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await writeStoredKey(db, key);
    return key;
  } finally {
    db.close();
  }
};

const getStorageKeyOnce = () => {
  storageKeyPromise ??= getStorageKey().catch(() => null);
  return storageKeyPromise;
};

const getAdditionalData = (storageKey: string) => (
  textEncoder.encode(`${STORAGE_PRIVACY_SEED}:${storageKey}:v${ENCRYPTED_STORAGE_VERSION}`)
);

const encryptString = async (storageKey: string, value: string) => {
  const key = await getStorageKeyOnce();
  if (!key) return null;

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: ENCRYPTED_ALGORITHM, iv, additionalData: getAdditionalData(storageKey) },
    key,
    textEncoder.encode(value),
  );

  const envelope: EncryptedEnvelope = {
    v: ENCRYPTED_STORAGE_VERSION,
    i: bytesToBase64(iv),
    d: bytesToBase64(new Uint8Array(encrypted)),
    t: Date.now(),
  };

  return JSON.stringify(envelope);
};

const decryptString = async (storageKey: string, value: string) => {
  if (!isEncryptedStorageEnvelope(value)) return value;
  const key = await getStorageKeyOnce();
  if (!key) return null;

  try {
    const envelope = JSON.parse(value) as Partial<EncryptedEnvelope & LegacyEncryptedEnvelope>;
    const iv = envelope.i || envelope.iv;
    const data = envelope.d || envelope.data;
    if (!iv || !data) return null;

    const ivBytes = base64ToBytes(iv);
    const dataBytes = base64ToBytes(data);
    let decrypted: ArrayBuffer;
    try {
      decrypted = await window.crypto.subtle.decrypt(
        { name: ENCRYPTED_ALGORITHM, iv: ivBytes, additionalData: getAdditionalData(storageKey) },
        key,
        dataBytes,
      );
    } catch {
      decrypted = await window.crypto.subtle.decrypt(
        { name: ENCRYPTED_ALGORITHM, iv: ivBytes },
        key,
        dataBytes,
      );
    }
    return textDecoder.decode(decrypted);
  } catch {
    return null;
  }
};

const persistEncryptedValue = (key: string, value: string) => {
  decryptedValues.set(key, value);
  void encryptString(key, value)
    .then((encryptedValue) => {
      if (encryptedValue) window.localStorage.setItem(key, encryptedValue);
      else window.localStorage.removeItem(key);
    })
    .catch(() => {
      // Managed storage must not fall back to readable localStorage.
      window.localStorage.removeItem(key);
    });
};

export const initializeEncryptedStorage = async () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (!isBrowserStorageAvailable()) return;

  await getStorageKeyOnce();
  await Promise.all(MANAGED_STORAGE_KEYS.map(async (key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    const decrypted = await decryptString(key, raw);
    if (!decrypted) return;
    decryptedValues.set(key, decrypted);

    persistEncryptedValue(key, decrypted);
  }));
};

export const readStorageItem = (key: string) => {
  if (decryptedValues.has(key)) return decryptedValues.get(key) || null;
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(key);
  if (MANAGED_STORAGE_KEY_SET.has(key)) return null;
  if (!isEncryptedStorageEnvelope(raw)) return raw;
  return null;
};

export const writeStorageItem = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  persistEncryptedValue(key, value);
};

export const removeStorageItem = (key: string) => {
  if (typeof window === 'undefined') return;
  decryptedValues.delete(key);
  window.localStorage.removeItem(key);
};
