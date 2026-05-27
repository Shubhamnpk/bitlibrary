import React, { useEffect, useMemo, useState } from 'react';
import { Audiobook, Book } from '@/types/index';
import { CURRICULUM_GRADES, CURRICULUM_SUBJECTS } from '@/constants';
import { fetchBooksFromYoBook, fetchYoBookGuideRows } from '@/services/bookService';
import { fetchYoBookAudiobooks, isYoBookAudioBook, mapYoBookAudioToAudiobook } from '@/services/audiobookService';
import BookCard from '@/components/BookCard';
import AudiobookCard from '@/components/AudiobookCard';
import { BookCardSkeleton, BookGridSkeleton } from '@/components/Skeletons';
import Seo from '@/components/Seo';
import { BookMarked, BookOpen, ChevronDown, GraduationCap, Headphones, LayoutGrid, LibraryBig, ListFilter, RotateCcw, Search } from 'lucide-react';
import { createItemListSchema, truncate } from '@/lib/seo';

interface CurriculumPageProps {
  onBookClick: (book: Book) => void;
  onAudiobookClick: (audiobook: Audiobook) => void;
  onRead: (book: Book) => void;
}

type ResourceMode = 'all' | 'textbooks' | 'audiobooks' | 'stories' | 'teacher-guides';
type GradeRows = Record<number, Book[]>;
type AudioGradeRows = Record<number, Audiobook[]>;

const modeLabels: Record<ResourceMode, string> = {
  all: 'All',
  textbooks: 'Textbooks',
  audiobooks: 'Audiobooks',
  stories: 'Stories',
  'teacher-guides': 'Guides',
};

const emptyRows = (): GradeRows => (
  CURRICULUM_GRADES.reduce<GradeRows>((rows, grade) => {
    rows[grade] = [];
    return rows;
  }, {})
);

const emptyAudioRows = (): AudioGradeRows => (
  CURRICULUM_GRADES.reduce<AudioGradeRows>((rows, grade) => {
    rows[grade] = [];
    return rows;
  }, {})
);

const dedupeBooks = (books: Book[]) => books.filter((book, index, list) => (
  list.findIndex((entry) => entry.id === book.id) === index
));

const dedupeAudiobooks = (audiobooks: Audiobook[]) => audiobooks.filter((audiobook, index, list) => (
  list.findIndex((entry) => entry.id === audiobook.id) === index
));

const matchesResourceMode = (book: Book, resourceMode: ResourceMode) => {
  if (resourceMode === 'all') return true;
  const searchableText = `${book.title} ${book.category} ${book.description} ${(book.subjects || []).join(' ')}`.toLowerCase();

  if (resourceMode === 'stories') {
    return /story|reader|reading|stories/.test(searchableText);
  }

  return !/story|reader|reading|stories/.test(searchableText);
};

const filterBooks = (books: Book[], selectedSubject: string, resourceMode: ResourceMode) => (
  books.filter((book) => {
    if (resourceMode === 'audiobooks' || resourceMode === 'teacher-guides') return false;
    const matchesSubject = selectedSubject === 'all'
      || book.category === selectedSubject
      || book.subjects?.includes(selectedSubject);

    return matchesSubject && matchesResourceMode(book, resourceMode);
  })
);

const filterGuides = (guides: Book[], selectedSubject: string, resourceMode: ResourceMode) => (
  resourceMode === 'teacher-guides'
    ? guides.filter((guide) => (
      selectedSubject === 'all'
      || guide.category === selectedSubject
      || guide.subjects?.includes(selectedSubject)
    ))
    : []
);

const filterAudiobooks = (audiobooks: Audiobook[], selectedSubject: string, resourceMode: ResourceMode) => (
  audiobooks.filter((audiobook) => {
    if (resourceMode !== 'all' && resourceMode !== 'audiobooks') return false;
    return selectedSubject === 'all' || audiobook.genres.includes(selectedSubject);
  })
);

const CurriculumPage: React.FC<CurriculumPageProps> = ({ onBookClick, onAudiobookClick, onRead }) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [resourceMode, setResourceMode] = useState<ResourceMode>('all');
  const [gradeRows, setGradeRows] = useState<GradeRows>(() => emptyRows());
  const [guideRows, setGuideRows] = useState<GradeRows>(() => emptyRows());
  const [audioRows, setAudioRows] = useState<AudioGradeRows>(() => emptyAudioRows());
  const [curriculumAudiobooks, setCurriculumAudiobooks] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCurriculumRows = async () => {
      setLoading(true);
      try {
        const [results, teacherGuides, featuredAudio] = await Promise.all([
          Promise.all(CURRICULUM_GRADES.map(async (grade) => {
            const { books } = await fetchBooksFromYoBook(1, `Class ${grade}`, controller.signal);
            const gradeBooks = books.filter((book) => !book.grade || book.grade === grade);
            const audiobooks = dedupeAudiobooks(
              gradeBooks
                .filter(isYoBookAudioBook)
                .map(mapYoBookAudioToAudiobook)
                .filter((audiobook): audiobook is Audiobook => Boolean(audiobook))
            );
            const writtenBooks = dedupeBooks(gradeBooks.filter((book) => !isYoBookAudioBook(book)));
            return [grade, writtenBooks, audiobooks] as const;
          })),
          fetchYoBookGuideRows(controller.signal),
          fetchYoBookAudiobooks(24, controller.signal),
        ]);

        if (!isMounted) return;
        setGradeRows(Object.fromEntries(results.map(([grade, books]) => [grade, books])) as GradeRows);
        setGuideRows({ ...emptyRows(), ...teacherGuides });
        setAudioRows(Object.fromEntries(results.map(([grade, , audiobooks]) => [grade, audiobooks])) as AudioGradeRows);
        setCurriculumAudiobooks(dedupeAudiobooks(featuredAudio));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[Curriculum Sync] Error:', error);
          setGradeRows(emptyRows());
          setGuideRows(emptyRows());
          setAudioRows(emptyAudioRows());
          setCurriculumAudiobooks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadCurriculumRows();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const visibleRows = useMemo(() => {
    const grades = selectedGrade === 'all' ? CURRICULUM_GRADES : [selectedGrade];

    return grades.map((grade) => ({
      grade,
      books: filterBooks(gradeRows[grade] || [], selectedSubject, resourceMode),
      guides: filterGuides(guideRows[grade] || [], selectedSubject, resourceMode),
      audiobooks: filterAudiobooks(audioRows[grade] || [], selectedSubject, resourceMode),
      total: (gradeRows[grade]?.length || 0) + (guideRows[grade]?.length || 0) + (audioRows[grade]?.length || 0),
    }));
  }, [audioRows, gradeRows, guideRows, resourceMode, selectedGrade, selectedSubject]);

  const allVisibleBooks = useMemo(() => (
    visibleRows.flatMap((row) => row.books)
  ), [visibleRows]);
  const allVisibleGuides = useMemo(() => (
    visibleRows.flatMap((row) => row.guides)
  ), [visibleRows]);
  const allVisibleAudiobooks = useMemo(() => (
    visibleRows.flatMap((row) => row.audiobooks)
  ), [visibleRows]);
  const visibleCurriculumAudiobooks = useMemo(() => (
    selectedGrade === 'all' ? filterAudiobooks(curriculumAudiobooks, selectedSubject, resourceMode) : []
  ), [curriculumAudiobooks, resourceMode, selectedGrade, selectedSubject]);

  const hasActiveFilters = selectedGrade !== 'all' || selectedSubject !== 'all' || resourceMode !== 'all';
  const activeCategory = selectedGrade === 'all' ? 'All grades' : `Grade ${selectedGrade}`;
  const availableBookCount = Object.values(gradeRows).flat().length;
  const availableGuideCount = Object.values(guideRows).flat().length;
  const availableAudioCount = Object.values(audioRows).flat().length + curriculumAudiobooks.length;
  const availableCount = availableBookCount + availableGuideCount + availableAudioCount;

  const resetFilters = () => {
    setSelectedGrade('all');
    setSelectedSubject('all');
    setResourceMode('all');
  };

  return (
    <div className="animate-fade-in pb-20">
      <Seo
        title="Nepali Curriculum Books for Classes 1-12 | BitLibrary"
        description={truncate('Browse CDC Nepal and CEHRD curriculum books by class, subject, textbooks, and learning resources inside BitLibrary.', 155)}
        canonicalPath="/curriculum"
        keywords={['Nepali curriculum books', 'CDC Nepal textbooks', 'CEHRD books', 'class 1 to 12 books', 'Nepali education books']}
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Nepali Curriculum Books',
            description: 'CDC Nepal and CEHRD curriculum books for classes 1 through 12.',
          },
          ...(allVisibleBooks.length > 0 ? [
            createItemListSchema(
              allVisibleBooks.map((book) => ({
                name: book.title,
                path: `/book/${book.id}`,
                image: book.coverUrl,
              })),
              'Nepali curriculum books on BitLibrary'
            ),
          ] : []),
        ]}
      />

      <section className="mb-8 border-b border-bit-border pb-8">
        <div className="mb-5 flex items-center gap-2 text-bit-accent">
          <GraduationCap size={18} />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em]">Curriculum</p>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight text-bit-text sm:text-5xl">Nepali Curriculum</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted">
              Browse school books grade by grade, with quick filters only when you need to narrow the shelf.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
              <LibraryBig size={15} className="text-bit-accent" />
              {availableCount || '...'} resources
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
              <Headphones size={15} className="text-bit-accent" />
              {availableAudioCount || '...'} audio
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
              <BookMarked size={15} className="text-bit-accent" />
              {availableGuideCount || '...'} guides
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
              <LayoutGrid size={15} className="text-bit-accent" />
              Grades 1-12
            </span>
          </div>
        </div>
      </section>

      <section className="mb-10 border-y border-bit-border bg-bit-bg/95 py-3 backdrop-blur-xl">
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto whitespace-nowrap pb-1">
          <div className="flex shrink-0 items-center gap-2 text-bit-accent">
            <ListFilter size={16} />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Filter</p>
          </div>

          <div className="flex shrink-0 flex-nowrap items-center gap-3">
            <label className="relative flex h-10 w-44 items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/20 px-3 transition-colors focus-within:border-bit-accent/50">
              <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">Grade</span>
              <select
                value={selectedGrade}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedGrade(value === 'all' ? 'all' : Number(value));
                }}
                className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-bit-text outline-none"
              >
                <option value="all" className="bg-bit-bg text-bit-text">All grades</option>
                {CURRICULUM_GRADES.map((grade) => (
                  <option key={grade} value={grade} className="bg-bit-bg text-bit-text">Grade {grade}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 text-bit-muted" size={14} />
            </label>

            <label className="relative flex h-10 w-56 items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/20 px-3 transition-colors focus-within:border-bit-accent/50">
              <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">Subject</span>
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-xs font-semibold text-bit-text outline-none"
              >
                <option value="all" className="bg-bit-bg text-bit-text">All subjects</option>
                {CURRICULUM_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject} className="bg-bit-bg text-bit-text">{subject}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 text-bit-muted" size={14} />
            </label>

            <div className="flex h-10 rounded-lg border border-bit-border bg-bit-panel/20 p-1">
              {(Object.keys(modeLabels) as ResourceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setResourceMode(mode)}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${resourceMode === mode ? 'bg-bit-accent text-white' : 'text-bit-muted hover:text-bit-text'}`}
                >
                  {mode === 'stories' ? <Search size={13} /> : mode === 'textbooks' ? <BookOpen size={13} /> : mode === 'audiobooks' ? <Headphones size={13} /> : mode === 'teacher-guides' ? <BookMarked size={13} /> : <LayoutGrid size={13} />}
                  {modeLabels[mode]}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-bit-border px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:border-bit-accent/50 hover:text-bit-text"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">{activeCategory}</p>
            <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">
              {hasActiveFilters ? 'Filtered curriculum books' : 'Browse by grade'}
            </h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-bit-muted">
            {loading ? 'Loading shelves' : `${allVisibleBooks.length + allVisibleGuides.length + allVisibleAudiobooks.length + visibleCurriculumAudiobooks.length} visible`}
          </p>
        </div>

        {loading ? (
          selectedGrade === 'all' ? (
            <div className="space-y-10">
              {[1, 2, 3].map((grade) => (
                <div key={grade}>
                  <div className="mb-4 h-7 w-32 animate-shimmer rounded bg-bit-panel/40" />
                  <div className="flex gap-4 overflow-hidden">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="w-40 shrink-0 sm:w-44 lg:w-48">
                        <BookCardSkeleton />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BookGridSkeleton count={8} />
          )
        ) : allVisibleBooks.length + allVisibleGuides.length + allVisibleAudiobooks.length + visibleCurriculumAudiobooks.length > 0 ? (
          <div className="space-y-12">
            {visibleCurriculumAudiobooks.length > 0 && (
              <div className="border-b border-bit-border/60 pb-10">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
                      {visibleCurriculumAudiobooks.length} audio resources
                    </p>
                    <h3 className="mt-1 text-2xl font-display font-bold tracking-tight text-bit-text">Curriculum audiobooks</h3>
                  </div>
                </div>
                <div className="flex snap-x gap-4 overflow-x-auto pb-4">
                  {visibleCurriculumAudiobooks.map((audiobook, index) => (
                    <div
                      key={audiobook.id}
                      className="w-40 shrink-0 snap-start animate-fade-in-up sm:w-44 lg:w-48"
                      style={{ animationDelay: `${(index % 5) * 35}ms` }}
                    >
                      <div className="relative h-full">
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
                          Audio
                        </div>
                        <AudiobookCard variant="compact" audiobook={audiobook} onClick={onAudiobookClick} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {visibleRows.filter((row) => row.books.length > 0 || row.guides.length > 0 || row.audiobooks.length > 0).map((row) => (
              <div key={row.grade} className="border-b border-bit-border/60 pb-10 last:border-b-0">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
                      {row.books.length + row.guides.length + row.audiobooks.length} of {row.total || row.books.length + row.guides.length + row.audiobooks.length} resources
                    </p>
                    <h3 className="mt-1 text-2xl font-display font-bold tracking-tight text-bit-text">Grade {row.grade}</h3>
                  </div>
                  {selectedGrade === 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedGrade(row.grade)}
                      className="shrink-0 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent hover:text-bit-text"
                    >
                      View grade
                    </button>
                  )}
                </div>
                {row.guides.length > 0 && (
                  <div className="mb-7">
                    <div className="mb-3 flex items-center gap-2 text-bit-accent">
                      <BookMarked size={15} />
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Guides</p>
                    </div>
                    <div className={selectedGrade === 'all' ? 'flex snap-x gap-4 overflow-x-auto pb-4' : 'grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 xl:grid-cols-5'}>
                      {row.guides.slice(0, selectedGrade === 'all' ? 4 : undefined).map((guide, index) => (
                        <div
                          key={guide.id}
                          className={`${selectedGrade === 'all' ? 'w-40 shrink-0 snap-start sm:w-44 lg:w-48' : ''} animate-fade-in-up`}
                          style={{ animationDelay: `${(index % 5) * 35}ms` }}
                        >
                          <div className="relative h-full">
                            <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
                              Guide
                            </div>
                            <BookCard variant="compact" book={guide} onClick={onBookClick} onRead={onRead} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(row.books.length > 0 || row.audiobooks.length > 0) && (
                <div className={selectedGrade === 'all' ? 'flex snap-x gap-4 overflow-x-auto pb-4' : 'grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 xl:grid-cols-5'}>
                  {row.books.slice(0, selectedGrade === 'all' ? 8 : undefined).map((book, index) => (
                    <div
                      key={book.id}
                      className={`${selectedGrade === 'all' ? 'w-40 shrink-0 snap-start sm:w-44 lg:w-48' : ''} animate-fade-in-up`}
                      style={{ animationDelay: `${(index % 5) * 35}ms` }}
                    >
                      <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
                    </div>
                  ))}
                  {row.audiobooks.slice(0, selectedGrade === 'all' ? 4 : undefined).map((audiobook, index) => (
                    <div
                      key={audiobook.id}
                      className={`${selectedGrade === 'all' ? 'w-40 shrink-0 snap-start sm:w-44 lg:w-48' : ''} animate-fade-in-up`}
                      style={{ animationDelay: `${((row.books.length + index) % 5) * 35}ms` }}
                    >
                      <div className="relative h-full">
                        <div className="absolute -top-3 left-3 z-20 rounded-full bg-bit-accent px-2 py-1 text-[8px] font-bold font-mono uppercase tracking-widest text-white shadow-[0_0_15px_rgba(var(--bit-accent-rgb),0.28)]">
                          Audio
                        </div>
                        <AudiobookCard variant="compact" audiobook={audiobook} onClick={onAudiobookClick} />
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-bit-border bg-bit-panel/20 px-6 py-20 text-center">
            <BookOpen size={38} className="mx-auto mb-5 text-bit-border" />
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-bit-muted">No curriculum resources match these filters.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-bit-border px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent hover:border-bit-accent/50 hover:text-bit-text"
              >
                <RotateCcw size={13} />
                Show all grades
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default CurriculumPage;
