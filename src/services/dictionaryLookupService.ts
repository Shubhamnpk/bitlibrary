import { fetchEnglishDictionaryEntries } from '@/services/englishDictionaryService';
import { fetchNepaliDictionaryEntries } from '@/services/nepaliDictionaryService';

export type DictionaryLanguage = 'english' | 'nepali';

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  etymology?: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryEntry {
  language: DictionaryLanguage;
  word: string;
  phonetic?: string;
  audio?: string;
  origin?: string;
  meanings: DictionaryMeaning[];
}

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/u;
const ENGLISH_WORD_PATTERN = /^[A-Za-z][A-Za-z'-]*$/;

export const getDictionaryLanguageForQuery = (query: string): DictionaryLanguage | null => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;
  if (DEVANAGARI_PATTERN.test(normalizedQuery)) return 'nepali';
  if (ENGLISH_WORD_PATTERN.test(normalizedQuery)) return 'english';
  return null;
};

export const fetchDictionaryEntries = async (query: string, signal?: AbortSignal): Promise<DictionaryEntry[]> => {
  const language = getDictionaryLanguageForQuery(query);
  if (language === 'nepali') {
    const entries = await fetchNepaliDictionaryEntries(query, signal);

    return entries.map((entry) => ({
      language,
      word: entry.word,
      meanings: entry.definitions
        .map((definition) => ({
          partOfSpeech: definition.grammar || 'अर्थ',
          etymology: definition.etymology,
          definitions: definition.senses.map((sense) => ({
            definition: sense,
            synonyms: [],
            antonyms: [],
          })),
        }))
        .filter((meaning) => meaning.definitions.length > 0),
    }));
  }

  if (language === 'english') {
    const entries = await fetchEnglishDictionaryEntries(query, signal);

    return entries.map((entry) => ({
      ...entry,
      language,
    }));
  }

  return [];
};
