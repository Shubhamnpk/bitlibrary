import nspell from 'nspell';
import aff from '../../node_modules/dictionary-ne/index.aff?raw';
import dic from '../../node_modules/dictionary-ne/index.dic?raw';

export interface NepaliSpellcheckIssue {
  word: string;
  count: number;
  suggestions: string[];
}

export interface NepaliSpellcheckResult {
  checkedWords: number;
  issues: NepaliSpellcheckIssue[];
}

const NEPALI_WORD_PATTERN = /[\u0900-\u097F]+/g;
let spellcheckerPromise: Promise<nspell> | null = null;

const getNepaliSpellchecker = async () => {
  if (!spellcheckerPromise) {
    spellcheckerPromise = Promise.resolve(nspell(aff, dic));
  }

  return spellcheckerPromise;
};

const extractNepaliWords = (text: string) => (
  text.match(NEPALI_WORD_PATTERN)?.map((word) => word.trim()).filter(Boolean) || []
);

export const checkNepaliSpelling = async (text: string): Promise<NepaliSpellcheckResult> => {
  const words = extractNepaliWords(text);
  const spellchecker = await getNepaliSpellchecker();
  const issueMap = new Map<string, NepaliSpellcheckIssue>();

  words.forEach((word) => {
    if (spellchecker.correct(word)) return;

    const current = issueMap.get(word);
    if (current) {
      current.count += 1;
      return;
    }

    issueMap.set(word, {
      word,
      count: 1,
      suggestions: spellchecker.suggest(word).slice(0, 5),
    });
  });

  return {
    checkedWords: words.length,
    issues: Array.from(issueMap.values()),
  };
};

