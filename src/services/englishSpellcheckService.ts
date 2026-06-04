import nspell from 'nspell';
import aff from '../../node_modules/dictionary-en/index.aff?raw';
import dic from '../../node_modules/dictionary-en/index.dic?raw';

export interface EnglishSpellcheckIssue {
  word: string;
  count: number;
  suggestions: string[];
}

export interface EnglishSpellcheckResult {
  checkedWords: number;
  issues: EnglishSpellcheckIssue[];
}

const ENGLISH_WORD_PATTERN = /[A-Za-z][A-Za-z'-]*/g;
let spellcheckerPromise: Promise<nspell> | null = null;

const getEnglishSpellchecker = async () => {
  if (!spellcheckerPromise) {
    spellcheckerPromise = Promise.resolve(nspell(aff, dic));
  }

  return spellcheckerPromise;
};

const extractEnglishWords = (text: string) => (
  text.match(ENGLISH_WORD_PATTERN)?.map((word) => word.trim()).filter((word) => word.length > 1) || []
);

export const checkEnglishSpelling = async (text: string): Promise<EnglishSpellcheckResult> => {
  const words = extractEnglishWords(text);
  const spellchecker = await getEnglishSpellchecker();
  const issueMap = new Map<string, EnglishSpellcheckIssue>();

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
