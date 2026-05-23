import React, { useEffect, useMemo, useState } from 'react';
import { Book } from '@/types/index';
import { CURRICULUM_GRADES, CURRICULUM_SUBJECTS } from '@/constants';
import { fetchBooksFromYoBook } from '@/services/bookService';
import BookCard from '@/components/BookCard';
import { BookGridSkeleton } from '@/components/Skeletons';
import Seo from '@/components/Seo';
import { BookOpen, GraduationCap, Layers3, LayoutGrid, Search, SlidersHorizontal } from 'lucide-react';
import { createItemListSchema, truncate } from '@/lib/seo';

interface CurriculumPageProps {
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
}

type ResourceMode = 'all' | 'textbooks' | 'stories';

const modeLabels: Record<ResourceMode, string> = {
  all: 'All',
  textbooks: 'Textbooks',
  stories: 'Stories',
};

const CurriculumPage: React.FC<CurriculumPageProps> = ({ onBookClick, onRead }) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [resourceMode, setResourceMode] = useState<ResourceMode>('all');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCategory = selectedGrade === 'all' ? 'Nepali Curriculum' : `Class ${selectedGrade}`;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCurriculum = async () => {
      setLoading(true);
      try {
        const category = selectedSubject !== 'all'
          ? selectedSubject
          : selectedGrade === 'all'
            ? 'Nepali Curriculum'
            : `Class ${selectedGrade}`;

        const { books: results } = await fetchBooksFromYoBook(1, category, controller.signal);
        if (!isMounted) return;

        const filtered = results.filter((book) => {
          const matchesGrade = selectedGrade === 'all' || book.grade === selectedGrade;
          const matchesSubject = selectedSubject === 'all' || book.category === selectedSubject || book.subjects?.includes(selectedSubject);
          const searchableText = `${book.title} ${book.description} ${(book.subjects || []).join(' ')}`.toLowerCase();
          const matchesMode = resourceMode === 'all'
            || (resourceMode === 'textbooks' && book.category !== 'Stories')
            || (resourceMode === 'stories' && /story|reader|reading|stories/.test(searchableText));

          return matchesGrade && matchesSubject && matchesMode;
        });

        setBooks(filtered);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[Curriculum Sync] Error:', error);
          setBooks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadCurriculum();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [resourceMode, selectedGrade, selectedSubject]);

  const gradeCounts = useMemo(() => {
    return CURRICULUM_GRADES.map((grade) => ({
      grade,
      count: books.filter((book) => book.grade === grade).length,
    }));
  }, [books]);

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
          ...(books.length > 0 ? [
            createItemListSchema(
              books.map((book) => ({
                name: book.title,
                path: `/book/${book.id}`,
                image: book.coverUrl,
              })),
              'Nepali curriculum books on BitLibrary'
            ),
          ] : []),
        ]}
      />

      <section className="mb-10 border-b border-bit-border pb-10">
        <div className="mb-5 flex items-center gap-2 text-bit-accent">
          <GraduationCap size={18} />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em]">Curriculum</p>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-5xl font-display font-bold tracking-tight text-bit-text">Nepali Curriculum</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted">
              A dedicated shelf for CDC Nepal and CEHRD learning materials, kept separate from the broader BitLibrary archive.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-bit-muted">Classes</p>
              <p className="mt-1 text-2xl font-display font-bold text-bit-text">1-12</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-bit-muted">Source</p>
              <p className="mt-1 text-2xl font-display font-bold text-bit-text">CEHRD</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-bit-muted">Active</p>
              <p className="mt-1 text-2xl font-display font-bold text-bit-text">{books.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 space-y-6 rounded-2xl border border-bit-border bg-bit-panel/25 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-bit-accent">
          <SlidersHorizontal size={16} />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Browse Controls</p>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted">Classes</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedGrade('all')}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${selectedGrade === 'all' ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
            >
              All
            </button>
            {CURRICULUM_GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => setSelectedGrade(grade)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${selectedGrade === grade ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
              >
                Class {grade}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted">Subjects</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubject('all')}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${selectedSubject === 'all' ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
              >
                All subjects
              </button>
              {CURRICULUM_SUBJECTS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setSelectedSubject(subject)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${selectedSubject === subject ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'}`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-muted">Resource Type</p>
            <div className="inline-flex rounded-xl border border-bit-border bg-bit-bg/40 p-1">
              {(Object.keys(modeLabels) as ResourceMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setResourceMode(mode)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${resourceMode === mode ? 'bg-bit-accent text-white' : 'text-bit-muted hover:text-bit-text'}`}
                >
                  {mode === 'stories' ? <Search size={13} /> : mode === 'textbooks' ? <BookOpen size={13} /> : <LayoutGrid size={13} />}
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">{activeCategory}</p>
            <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">Curriculum Books</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {gradeCounts.filter((entry) => entry.count > 0).slice(0, 6).map(({ grade, count }) => (
              <span key={grade} className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                <Layers3 size={12} className="text-bit-accent" />
                Class {grade}: {count}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <BookGridSkeleton count={8} />
        ) : books.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-10 lg:grid-cols-4">
            {books.map((book, index) => (
              <div key={book.id} className="animate-fade-in-up" style={{ animationDelay: `${(index % 8) * 35}ms` }}>
                <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-bit-border bg-bit-panel/25 px-6 py-20 text-center">
            <BookOpen size={38} className="mx-auto mb-5 text-bit-border" />
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-bit-muted">No curriculum resources match these filters.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default CurriculumPage;
