import { Audiobook, Book } from '@/types/index';
import { fetchBooksFromYoBook, searchYoBookBooks } from '@/services/bookService';

const SUBJECT_ALIASES: Record<string, string> = {
  algebra: 'mathematics',
  arithmetic: 'mathematics',
  biology: 'science',
  chemistry: 'science',
  englishs: 'english',
  environment: 'science',
  gk: 'social studies',
  hamro: 'hamro serofero',
  mathematic: 'mathematics',
  mathematics: 'mathematics',
  math: 'mathematics',
  maths: 'mathematics',
  english: 'english',
  nepali: 'nepali',
  neplai: 'nepali',
  physics: 'science',
  sciece: 'science',
  scince: 'science',
  science: 'science',
  sience: 'science',
  social: 'social studies',
  socials: 'social studies',
  society: 'social studies',
  health: 'health',
  serofero: 'hamro serofero',
};

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  tin: '10',
  eleven: '11',
  twelve: '12',
};

const SEARCH_STOP_WORDS = new Set([
  'book',
  'books',
  'textbook',
  'textbooks',
  'subject',
  'subjects',
  'the',
  'a',
  'an',
  'of',
  'for',
  'in',
  'and',
  'only',
]);

const GRADE_HINT_WORDS = new Set(['class', 'grade', 'standard', 'std', 'clas', 'clss', 'klass', 'grad', 'garde']);
const SUBJECT_CANONICALS = Array.from(new Set(Object.values(SUBJECT_ALIASES)));

export const mergeUniqueBooks = (...collections: Book[][]): Book[] => {
  const seen = new Set<string>();
  const merged: Book[] = [];

  collections.flat().forEach((book) => {
    if (!book?.id || seen.has(book.id)) return;
    seen.add(book.id);
    merged.push(book);
  });

  return merged;
};

const toSearchableText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => toSearchableText(item)).join(' ');
  if (typeof value === 'object') {
    const maybeText = (value as { text?: unknown }).text;
    if (typeof maybeText === 'string') return maybeText;
    return '';
  }
  return String(value);
};

export const normalizeForSearch = (value: string) => (
  value
    .toLowerCase()
    .replace(/\b(clas|clss|klass)\b/g, 'class')
    .replace(/\b(grad|garde)\b/g, 'grade')
    .replace(/\b(class|grade|standard|std)\s+(one|two|three|four|five|six|seven|eight|nine|ten|tin|eleven|twelve)\b/g, (_, prefix, word) => `${prefix} ${NUMBER_WORDS[word]}`)
    .replace(/\b(1st|2nd|3rd|([4-9]|1[0-2])th)\b/g, (match) => match.replace(/\D/g, ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmaths?\b/g, 'mathematics')
    .replace(/\b(sciece|scince|sience)\b/g, 'science')
    .replace(/\bsocial\b(?!\s+studies)/g, 'social studies')
    .replace(/\s+/g, ' ')
    .trim()
);

const tokenizeSearch = (value: string) => normalizeForSearch(value).split(' ').filter(Boolean);

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

const isFuzzyTokenMatch = (queryToken: string, candidateToken: string) => {
  if (queryToken === candidateToken) return true;
  if (queryToken.length <= 2 || candidateToken.length <= 2) return false;
  if (candidateToken.includes(queryToken) || queryToken.includes(candidateToken)) return true;

  const distance = levenshteinDistance(queryToken, candidateToken);
  const maxDistance = queryToken.length >= 8 || candidateToken.length >= 8 ? 2 : 1;
  return distance <= maxDistance;
};

const countFuzzyTokenMatches = (queryTokens: string[], candidateText: string) => {
  const candidateTokens = tokenizeSearch(candidateText);
  const usefulQueryTokens = queryTokens.filter((token) => !SEARCH_STOP_WORDS.has(token));

  return usefulQueryTokens.filter((queryToken) => {
    const canonicalToken = SUBJECT_ALIASES[queryToken] || queryToken;
    return candidateTokens.some((candidateToken) => isFuzzyTokenMatch(canonicalToken, SUBJECT_ALIASES[candidateToken] || candidateToken));
  }).length;
};

const findSubjectIntent = (tokens: string[], normalized: string) => {
  const direct = Object.entries(SUBJECT_ALIASES).find(([alias, canonical]) => (
    tokens.includes(alias) || normalized.includes(canonical)
  ))?.[1];
  if (direct) return direct;

  return SUBJECT_CANONICALS.find((subject) => (
    subject.split(' ').every((subjectToken) => tokens.some((token) => isFuzzyTokenMatch(token, subjectToken)))
  ));
};

const findGradeIntent = (tokens: string[], normalized: string) => {
  const explicitGradeMatch = normalized.match(/\b(?:class|grade|standard|std)\s*(\d{1,2})\b/);
  if (explicitGradeMatch) return Number(explicitGradeMatch[1]);

  const hintedNumber = tokens.find((token, index) => (
    /^\d{1,2}$/.test(token)
    && (
      GRADE_HINT_WORDS.has(tokens[index - 1])
      || GRADE_HINT_WORDS.has(tokens[index + 1])
      || tokens.some((candidate) => GRADE_HINT_WORDS.has(candidate))
    )
  ));
  if (hintedNumber) return Number(hintedNumber);

  return undefined;
};

export const getSearchIntent = (query: string) => {
  const normalized = normalizeForSearch(query);
  const tokens = normalized.split(' ').filter(Boolean);
  const subject = findSubjectIntent(tokens, normalized);
  const grade = findGradeIntent(tokens, normalized);
  const canonicalQuery = [
    grade ? `grade ${grade}` : '',
    subject || '',
    tokens.filter((token) => !GRADE_HINT_WORDS.has(token) && token !== String(grade) && !SEARCH_STOP_WORDS.has(token)).join(' '),
  ].filter(Boolean).join(' ');

  return {
    normalized,
    tokens,
    grade: grade && grade >= 1 && grade <= 12 ? grade : undefined,
    subject,
    canonicalQuery: normalizeForSearch(canonicalQuery || query),
  };
};

export const buildYoBookSearchVariants = (query: string): string[] => {
  const intent = getSearchIntent(query);
  const variants = new Set([query, intent.normalized, intent.canonicalQuery]);

  if (intent.grade) {
    variants.add(`Class ${intent.grade}`);
    variants.add(`Grade ${intent.grade}`);
  }

  if (intent.subject) {
    variants.add(intent.subject);
    if (intent.grade) {
      variants.add(`Class ${intent.grade} ${intent.subject}`);
      variants.add(`${intent.subject} Grade ${intent.grade}`);
    }
  }

  intent.tokens.forEach((token) => {
    const alias = SUBJECT_ALIASES[token];
    if (alias) variants.add(alias);
  });

  return Array.from(variants).map((item) => item.trim()).filter(Boolean);
};

export const searchYoBookBooksSmart = async (query: string, signal?: AbortSignal): Promise<Book[]> => {
  const intent = getSearchIntent(query);
  const variantSearches = buildYoBookSearchVariants(query).slice(0, 4).map((variant) => searchYoBookBooks(variant, signal));
  const gradeSearch = intent.grade ? [fetchBooksFromYoBook(1, `Class ${intent.grade}`, signal).then((result) => result.books)] : [];
  const results = await Promise.allSettled([...variantSearches, ...gradeSearch]);

  return mergeUniqueBooks(...results.map((result) => result.status === 'fulfilled' ? result.value : [])).slice(0, 100);
};

export const isAudioBookResource = (book: Book) => (
  Boolean(book.audioUrl)
  || book.providerSource === 'cehrd-audio'
  || /audio/i.test(book.category)
  || book.subjects?.some((subject) => /audio|drama|listening/i.test(subject))
);

export const getBookSearchScore = (book: Book, query: string): number => {
  const intent = getSearchIntent(query);
  const title = normalizeForSearch(toSearchableText(book.title));
  const desc = normalizeForSearch(toSearchableText(book.description));
  const author = normalizeForSearch(toSearchableText(book.author));
  const category = normalizeForSearch(toSearchableText(book.category));
  const subjects = normalizeForSearch((book.subjects || []).map((subject) => toSearchableText(subject)).join(' '));
  const keywords = normalizeForSearch((book.keywords || []).join(' '));
  const shelves = normalizeForSearch((book.bookshelves || []).join(' '));
  const haystack = normalizeForSearch([title, author, category, subjects, keywords, shelves, desc, book.grade ? `class ${book.grade} grade ${book.grade}` : ''].join(' '));

  let weight = 0;

  if (title === intent.normalized || title === intent.canonicalQuery) weight += 20000;
  if (title.startsWith(intent.normalized) || title.startsWith(intent.canonicalQuery)) weight += 9000;
  if (title.includes(intent.normalized) || title.includes(intent.canonicalQuery)) weight += 4500;
  if (intent.subject && [title, category, subjects, keywords, shelves].some((field) => field.includes(intent.subject!))) weight += 9000;
  if (intent.grade && book.grade === intent.grade) weight += 6000;
  if (intent.grade && haystack.includes(`grade ${intent.grade}`)) weight += 2000;
  if (intent.grade && haystack.includes(`class ${intent.grade}`)) weight += 2000;
  if (intent.grade && book.source === 'YoBook' && !book.grade && !haystack.includes(`grade ${intent.grade}`) && !haystack.includes(`class ${intent.grade}`)) weight -= 9000;
  if (author.includes(intent.normalized)) weight += 800;
  if (category.includes(intent.normalized)) weight += 400;
  if (subjects.includes(intent.normalized)) weight += 300;
  if (keywords.includes(intent.normalized) || keywords.includes(intent.canonicalQuery)) weight += 4200;
  if (desc.includes(intent.normalized)) weight += 200;

  const tokens = Array.from(new Set([...intent.tokens, ...tokenizeSearch(intent.subject || '')])).filter((token) => !GRADE_HINT_WORDS.has(token) && !SEARCH_STOP_WORDS.has(token));
  const matchedTokens = tokens.filter((token) => haystack.includes(SUBJECT_ALIASES[token] || token));
  const fuzzyMatches = countFuzzyTokenMatches(tokens, haystack);
  const keywordFuzzyMatches = countFuzzyTokenMatches(tokens, keywords);
  weight += matchedTokens.length * 350;
  weight += fuzzyMatches * 450;
  weight += keywordFuzzyMatches * 900;
  if (tokens.length > 0 && matchedTokens.length === tokens.length) weight += 1200;
  if (tokens.length > 0 && fuzzyMatches === tokens.length) weight += 900;

  weight += Math.min(book.downloads || 0, 5000) / 25;
  weight += book.source === 'YoBook' ? 12000 : 0;
  weight += book.audioUrl ? 1500 : 0;
  weight += book.source === 'neural' ? 150 : 0;

  return weight;
};

export const getAudiobookSearchScore = (audiobook: Audiobook, query: string): number => {
  const intent = getSearchIntent(query);
  const title = normalizeForSearch(audiobook.title);
  const author = normalizeForSearch(audiobook.author);
  const description = normalizeForSearch(audiobook.description);
  const genres = normalizeForSearch(audiobook.genres.join(' '));
  const haystack = normalizeForSearch([title, author, description, genres].join(' '));

  let weight = 0;
  if (title === intent.normalized || title === intent.canonicalQuery) weight += 24000;
  if (title.startsWith(intent.normalized) || title.startsWith(intent.canonicalQuery)) weight += 10000;
  if (title.includes(intent.normalized) || title.includes(intent.canonicalQuery)) weight += 6000;
  if (intent.subject && [title, genres, description].some((field) => field.includes(intent.subject!))) weight += 8000;
  if (intent.grade && haystack.includes(`grade ${intent.grade}`)) weight += 5000;
  if (intent.grade && haystack.includes(`class ${intent.grade}`)) weight += 5000;
  if (author.includes(intent.normalized)) weight += 900;

  const tokens = Array.from(new Set([...intent.tokens, ...tokenizeSearch(intent.subject || '')])).filter((token) => !GRADE_HINT_WORDS.has(token) && !SEARCH_STOP_WORDS.has(token));
  const matchedTokens = tokens.filter((token) => haystack.includes(SUBJECT_ALIASES[token] || token));
  const fuzzyMatches = countFuzzyTokenMatches(tokens, haystack);
  weight += matchedTokens.length * 400;
  weight += fuzzyMatches * 500;
  if (tokens.length > 0 && matchedTokens.length === tokens.length) weight += 1200;
  if (tokens.length > 0 && fuzzyMatches === tokens.length) weight += 900;
  weight += audiobook.source === 'YoBook' ? 50000 : 0;
  weight += Math.min(audiobook.numSections || 0, 50);

  return weight;
};

export const rankBooks = (books: Book[], query: string): Book[] => {
  return [...books].sort((a, b) => getBookSearchScore(b, query) - getBookSearchScore(a, query));
};

export const rankAudiobooks = (audiobooks: Audiobook[], query: string): Audiobook[] => {
  return [...audiobooks].sort((a, b) => getAudiobookSearchScore(b, query) - getAudiobookSearchScore(a, query));
};
