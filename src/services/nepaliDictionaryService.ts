export interface NepaliDictionaryDefinition {
  grammar?: string;
  etymology?: string;
  senses: string[];
}

export interface NepaliDictionaryEntry {
  word: string;
  definitions: NepaliDictionaryDefinition[];
}

interface YoShabdakoshWordIndexItem {
  word?: string;
  path?: string;
  chunk?: number;
}

interface YoShabdakoshWordsByLetterResponse {
  words?: YoShabdakoshWordIndexItem[];
}

interface YoShabdakoshChunkResponse {
  entries?: NepaliDictionaryEntry[];
}

const YO_SHABDAKOSH_API_BASE_URL = 'https://shubhamnpk.github.io/yoshabdakosh/api/v1';
const MAX_NEPALI_DICTIONARY_RESULTS = 8;

const wordIndexCache = new Map<string, Promise<YoShabdakoshWordIndexItem[]>>();
const chunkCache = new Map<string, Promise<NepaliDictionaryEntry[]>>();

const normalizeNepaliWord = (word: string) => word.trim().replace(/\s+/g, ' ');

const getFirstDevanagariCharacter = (word: string) => (
  Array.from(word).find((character) => /[\u0900-\u097F]/u.test(character))
);

const fetchJson = async <T>(path: string, signal?: AbortSignal): Promise<T | null> => {
  const response = await fetch(`${YO_SHABDAKOSH_API_BASE_URL}/${path}`, { signal });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Yo Shabdakosh lookup failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const getWordsByLetter = (letter: string, signal?: AbortSignal) => {
  const encodedLetter = encodeURIComponent(letter);
  const cacheKey = encodedLetter;
  const cached = wordIndexCache.get(cacheKey);
  if (cached) return cached;

  const request = fetchJson<YoShabdakoshWordsByLetterResponse>(`words-by-letter/${encodedLetter}.json`, signal)
    .then((data) => data?.words || []);
  wordIndexCache.set(cacheKey, request);
  return request;
};

const getChunkEntries = (path: string, signal?: AbortSignal) => {
  const cached = chunkCache.get(path);
  if (cached) return cached;

  const request = fetchJson<YoShabdakoshChunkResponse>(path, signal)
    .then((data) => data?.entries || []);
  chunkCache.set(path, request);
  return request;
};

export const fetchNepaliDictionaryEntries = async (word: string, signal?: AbortSignal): Promise<NepaliDictionaryEntry[]> => {
  const normalizedWord = normalizeNepaliWord(word);
  if (!normalizedWord) return [];

  const firstLetter = getFirstDevanagariCharacter(normalizedWord);
  if (!firstLetter) return [];

  const wordIndex = await getWordsByLetter(firstLetter, signal);
  const exactMatches = wordIndex.filter((item) => item.word === normalizedWord);
  const prefixMatches = exactMatches.length > 0
    ? exactMatches
    : wordIndex.filter((item) => item.word?.startsWith(normalizedWord)).slice(0, MAX_NEPALI_DICTIONARY_RESULTS);

  const chunkPaths = Array.from(new Set(prefixMatches.map((item) => item.path).filter(Boolean))) as string[];
  if (chunkPaths.length === 0) return [];

  const chunks = await Promise.all(chunkPaths.map((path) => getChunkEntries(path, signal)));
  const entries = chunks.flat();
  const matchedWords = new Set(prefixMatches.map((item) => item.word));

  return entries
    .filter((entry) => matchedWords.has(entry.word))
    .sort((a, b) => {
      if (a.word === normalizedWord) return -1;
      if (b.word === normalizedWord) return 1;
      return a.word.localeCompare(b.word, 'ne');
    })
    .slice(0, MAX_NEPALI_DICTIONARY_RESULTS);
};
