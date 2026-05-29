export interface EnglishDictionaryDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface EnglishDictionaryMeaning {
  partOfSpeech: string;
  definitions: EnglishDictionaryDefinition[];
}

export interface EnglishDictionaryEntry {
  word: string;
  phonetic?: string;
  audio?: string;
  origin?: string;
  meanings: EnglishDictionaryMeaning[];
}

interface DictionaryApiPhonetic {
  text?: string;
  audio?: string;
}

interface DictionaryApiDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface DictionaryApiMeaning {
  partOfSpeech?: string;
  definitions?: DictionaryApiDefinition[];
}

interface DictionaryApiEntry {
  word?: string;
  phonetic?: string;
  phonetics?: DictionaryApiPhonetic[];
  origin?: string;
  meanings?: DictionaryApiMeaning[];
}

const DICTIONARY_API_BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

const normalizeAudioUrl = (audio?: string) => {
  if (!audio) return undefined;
  if (audio.startsWith('//')) return `https:${audio}`;
  return audio;
};

export const fetchEnglishDictionaryEntries = async (word: string, signal?: AbortSignal): Promise<EnglishDictionaryEntry[]> => {
  const normalizedWord = word.trim().toLowerCase();
  if (!normalizedWord) return [];

  const response = await fetch(`${DICTIONARY_API_BASE_URL}/${encodeURIComponent(normalizedWord)}`, { signal });
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Dictionary lookup failed with status ${response.status}`);
  }

  const data = await response.json() as DictionaryApiEntry[];
  if (!Array.isArray(data)) return [];

  return data.map((entry) => {
    const audio = normalizeAudioUrl(entry.phonetics?.find((phonetic) => phonetic.audio)?.audio);
    const phonetic = entry.phonetic || entry.phonetics?.find((item) => item.text)?.text;

    return {
      word: entry.word || normalizedWord,
      phonetic,
      audio,
      origin: entry.origin,
      meanings: (entry.meanings || []).map((meaning) => ({
        partOfSpeech: meaning.partOfSpeech || 'meaning',
        definitions: (meaning.definitions || [])
          .filter((definition) => definition.definition)
          .slice(0, 3)
          .map((definition) => ({
            definition: definition.definition || '',
            example: definition.example,
            synonyms: definition.synonyms || [],
            antonyms: definition.antonyms || [],
          })),
      })).filter((meaning) => meaning.definitions.length > 0),
    };
  }).filter((entry) => entry.meanings.length > 0);
};

