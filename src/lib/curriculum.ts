import { CURRICULUM_GRADES, CURRICULUM_SUBJECTS } from '@/constants';
import type { Audiobook, Book } from '@/types/index';
import { isPriorCurriculumEdition } from '@/services/bookService';

export type ResourceMode = 'all' | 'textbooks' | 'audiobooks' | 'stories' | 'teacher-guides';
export type CurriculumRegion = 'all' | 'nepal' | 'ncert';
export type GradeRows = Record<number, Book[]>;
export type AudioGradeRows = Record<number, Audiobook[]>;

export const regionLabels: Record<CurriculumRegion, string> = {
  all: 'All',
  nepal: 'Nepal',
  ncert: 'NCERT',
};

export const modeLabels: Record<ResourceMode, string> = {
  all: 'All',
  textbooks: 'Textbooks',
  audiobooks: 'Audiobooks',
  stories: 'Stories',
  'teacher-guides': 'Guides',
};

export const emptyRows = (): GradeRows => (
  CURRICULUM_GRADES.reduce<GradeRows>((rows, grade) => {
    rows[grade] = [];
    return rows;
  }, {})
);

export const emptyAudioRows = (): AudioGradeRows => (
  CURRICULUM_GRADES.reduce<AudioGradeRows>((rows, grade) => {
    rows[grade] = [];
    return rows;
  }, {})
);

export const dedupeBooks = (books: Book[]) => books.filter((book, index, list) => (
  list.findIndex((entry) => entry.id === book.id) === index
));

export const dedupeAudiobooks = (audiobooks: Audiobook[]) => audiobooks.filter((audiobook, index, list) => (
  list.findIndex((entry) => entry.id === audiobook.id) === index
));

const GENERIC_AUDIO_SUBJECTS = new Set([
  'audio',
  'audiobook',
  'audio book',
  'cehrd',
  'cehrd audio',
  'cdc nepal',
  'nepal',
  'nepali curriculum',
  'pustakalaya',
]);

export const getCurriculumAudioSubjects = (audiobook: Audiobook) => (
  audiobook.genres
    .filter((genre) => genre && !GENERIC_AUDIO_SUBJECTS.has(genre.toLowerCase()))
    .filter((genre, index, list) => list.indexOf(genre) === index)
);

export const getCurriculumBookText = (book: Book) => (
  `${book.curriculum || ''} ${book.country || ''} ${book.providerSource || ''} ${book.source || ''} ${(book.subjects || []).join(' ')} ${(book.bookshelves || []).join(' ')}`.toLowerCase()
);

export const isNcertBook = (book: Book) => {
  const text = getCurriculumBookText(book);
  return book.country === 'in' || book.providerSource === 'ncert-official' || text.includes('ncert');
};

export const matchesCurriculumRegion = (book: Book, curriculumRegion: CurriculumRegion) => {
  if (curriculumRegion === 'all') return true;
  const text = getCurriculumBookText(book);

  if (curriculumRegion === 'ncert') {
    return isNcertBook(book);
  }

  if (isNcertBook(book)) return false;

  return book.country === 'np' || text.includes('cdc nepal') || text.includes('cehrd') || text.includes('nepali curriculum');
};

export const matchesCurriculumSubject = (book: Book, selectedSubject: string) => (
  selectedSubject === 'all'
  || book.category === selectedSubject
  || book.subjects?.includes(selectedSubject)
);

export const matchesResourceMode = (book: Book, resourceMode: ResourceMode) => {
  if (resourceMode === 'all') return true;
  const searchableText = `${book.title} ${book.category} ${book.description} ${(book.subjects || []).join(' ')}`.toLowerCase();

  if (resourceMode === 'stories') {
    return /story|reader|reading|stories/.test(searchableText);
  }

  return !/story|reader|reading|stories/.test(searchableText);
};

export const filterBooks = (books: Book[], selectedSubject: string, resourceMode: ResourceMode, curriculumRegion: CurriculumRegion) => (
  books.filter((book) => {
    if (resourceMode === 'audiobooks' || resourceMode === 'teacher-guides') return false;
    if (!matchesCurriculumRegion(book, curriculumRegion)) return false;
    if (isPriorCurriculumEdition(book)) return false;

    return matchesCurriculumSubject(book, selectedSubject) && matchesResourceMode(book, resourceMode);
  })
);

export const filterGuides = (guides: Book[], selectedSubject: string, resourceMode: ResourceMode, curriculumRegion: CurriculumRegion) => (
  resourceMode === 'all' || resourceMode === 'teacher-guides'
    ? guides.filter((guide) => {
      if (!matchesCurriculumRegion(guide, curriculumRegion)) return false;
      if (isPriorCurriculumEdition(guide)) return false;
      return matchesCurriculumSubject(guide, selectedSubject);
    })
    : []
);

export const filterAudiobooks = (audiobooks: Audiobook[], selectedSubject: string, resourceMode: ResourceMode, curriculumRegion: CurriculumRegion) => (
  audiobooks.filter((audiobook) => {
    if (curriculumRegion === 'ncert') return false;
    if (resourceMode !== 'all' && resourceMode !== 'audiobooks') return false;
    return selectedSubject === 'all' || getCurriculumAudioSubjects(audiobook).includes(selectedSubject);
  })
);

export const getAvailableCurriculumSubjects = (
  gradeRows: GradeRows,
  ungradedBooks: Book[],
  guideRows: GradeRows,
  ungradedGuides: Book[],
  curriculumAudiobooks: Audiobook[],
  curriculumRegion: CurriculumRegion,
) => {
  const subjects = new Set(CURRICULUM_SUBJECTS);
  [...Object.values(gradeRows).flat(), ...ungradedBooks, ...Object.values(guideRows).flat(), ...ungradedGuides].forEach((book) => {
    if (!matchesCurriculumRegion(book, curriculumRegion)) return;
    if (book.category) subjects.add(book.category);
  });
  if (curriculumRegion !== 'ncert') {
    curriculumAudiobooks.forEach((audiobook) => {
      getCurriculumAudioSubjects(audiobook).forEach((genre) => {
        if (genre) subjects.add(genre);
      });
    });
  }
  return Array.from(subjects).sort((a, b) => a.localeCompare(b));
};
