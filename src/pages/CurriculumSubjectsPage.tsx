import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookMarked, BookOpen, Calculator, GraduationCap, HeartPulse, Languages, Leaf, Sigma, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CURRICULUM_GRADES } from '@/constants';
import type { Book } from '@/types/index';
import BookCard from '@/components/BookCard';
import { BookCardSkeleton } from '@/components/Skeletons';
import Seo from '@/components/Seo';
import { fetchYoBookGuideCollection, fetchYoBookTextbookCollection } from '@/services/bookService';
import {
  GradeRows,
  emptyRows,
  filterBooks,
  filterGuides,
  matchesCurriculumRegion,
} from '@/lib/curriculum';
import { truncate } from '@/lib/seo';

interface CurriculumSubjectsPageProps {
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
}

const SUBJECT_CARDS = [
  { name: 'Science', icon: Sigma },
  { name: 'Mathematics', icon: Calculator },
  { name: 'English', icon: Languages },
  { name: 'Nepali', icon: BookOpen },
  { name: 'Social Studies', icon: UsersRound },
  { name: 'Health', icon: HeartPulse },
  { name: 'Hamro Serofero', icon: Leaf },
];

const CurriculumSubjectsPage: React.FC<CurriculumSubjectsPageProps> = ({ onBookClick, onRead }) => {
  const [selectedSubject, setSelectedSubject] = useState(SUBJECT_CARDS[0].name);
  const [gradeRows, setGradeRows] = useState<GradeRows>(() => emptyRows());
  const [guideRows, setGuideRows] = useState<GradeRows>(() => emptyRows());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCurriculum = async () => {
      setLoading(true);
      setError('');
      try {
        const [textbooksResult, guidesResult] = await Promise.allSettled([
          fetchYoBookTextbookCollection(controller.signal),
          fetchYoBookGuideCollection(controller.signal),
        ]);

        if (!isMounted) return;

        if (textbooksResult.status === 'fulfilled') {
          setGradeRows({ ...emptyRows(), ...textbooksResult.value.rows });
        } else {
          setGradeRows(emptyRows());
          setError('Subject browsing is partially unavailable right now.');
        }

        if (guidesResult.status === 'fulfilled') {
          setGuideRows({ ...emptyRows(), ...guidesResult.value.rows });
        } else {
          setGuideRows(emptyRows());
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
  }, []);

  const subjectCounts = useMemo(() => (
    SUBJECT_CARDS.reduce<Record<string, number>>((counts, subject) => {
      counts[subject.name] = CURRICULUM_GRADES.reduce((total, grade) => {
        const books = filterBooks(gradeRows[grade] || [], subject.name, 'textbooks', 'nepal');
        const guides = filterGuides(guideRows[grade] || [], subject.name, 'teacher-guides', 'nepal');
        return total + books.length + guides.length;
      }, 0);
      return counts;
    }, {})
  ), [gradeRows, guideRows]);

  const subjectRows = useMemo(() => (
    CURRICULUM_GRADES.map((grade) => {
      const books = filterBooks(gradeRows[grade] || [], selectedSubject, 'textbooks', 'nepal');
      const guides = filterGuides(guideRows[grade] || [], selectedSubject, 'teacher-guides', 'nepal');
      const total = (gradeRows[grade] || []).filter((book) => matchesCurriculumRegion(book, 'nepal')).length
        + (guideRows[grade] || []).filter((book) => matchesCurriculumRegion(book, 'nepal')).length;

      return {
        grade,
        books,
        guides,
        visible: books.length + guides.length,
        total,
      };
    }).filter((row) => row.visible > 0)
  ), [gradeRows, guideRows, selectedSubject]);

  const visibleCount = subjectRows.reduce((total, row) => total + row.visible, 0);

  return (
    <div className="animate-fade-in pb-20">
      <Seo
        title="Browse Curriculum by Subject | BitLibrary"
        description={truncate('Browse Nepali curriculum books by subject first, then choose the available grade rows for that subject.', 155)}
        canonicalPath="/curriculum/subjects"
        keywords={['browse curriculum by subject', 'Nepal school subjects', 'curriculum books by grade', 'BitLibrary subjects']}
      />

      <section className="mb-8 border-b border-bit-border pb-8">
        <Link
          to="/curriculum"
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/20 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/50 hover:text-bit-text"
        >
          <ArrowLeft size={14} />
          Back to grade view
        </Link>
        <div className="mb-5 flex items-center gap-2 text-bit-accent">
          <GraduationCap size={18} />
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em]">Browse by subject</p>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight text-bit-text sm:text-5xl">Subject Shelves</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted">
              Start with a subject, then scan the grade rows where books are available.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
            <BookMarked size={15} className="text-bit-accent" />
            {loading ? '...' : visibleCount} visible
          </div>
        </div>
      </section>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {SUBJECT_CARDS.map((subject) => {
          const Icon = subject.icon;
          const active = selectedSubject === subject.name;

          return (
            <button
              key={subject.name}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedSubject(subject.name)}
              className={`group flex min-h-32 flex-col justify-between rounded-lg border p-4 text-left transition-all ${active ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/20 text-bit-text hover:border-bit-accent/50 hover:bg-bit-panel/40'}`}
            >
              <span className="flex items-center justify-between gap-3">
                <Icon size={20} className={active ? 'text-white' : 'text-bit-accent'} />
                <ArrowRight size={16} className={`transition-transform group-hover:translate-x-0.5 ${active ? 'text-white' : 'text-bit-muted'}`} />
              </span>
              <span>
                <span className="block text-sm font-display font-bold leading-tight">{subject.name}</span>
                <span className={`mt-2 block text-[9px] font-mono font-bold uppercase tracking-widest ${active ? 'text-white/75' : 'text-bit-muted'}`}>
                  {loading ? 'Loading' : `${subjectCounts[subject.name] || 0} books`}
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">{selectedSubject}</p>
            <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">Available Grades</h2>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-bit-muted">
            {loading ? 'Loading books' : `${subjectRows.length} grades`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-10">
            {[1, 2, 3].map((row) => (
              <div key={row} className="border-b border-bit-border/60 pb-10">
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
        ) : subjectRows.length > 0 ? (
          <div className="space-y-12">
            {subjectRows.map((row) => (
              <div key={row.grade} className="scroll-mt-32 border-b border-bit-border/60 pb-10 last:border-b-0">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
                      {row.visible} matching resources
                    </p>
                    <h3 className="mt-1 text-2xl font-display font-bold tracking-tight text-bit-text">Grade {row.grade}</h3>
                  </div>
                </div>

                {row.guides.length > 0 && (
                  <div className="mb-7">
                    <div className="mb-3 flex items-center gap-2 text-bit-accent">
                      <BookMarked size={15} />
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]">Guides</p>
                    </div>
                    <div className="flex snap-x gap-4 overflow-x-auto pb-4">
                      {row.guides.map((guide, index) => (
                        <div
                          key={guide.id}
                          className="w-40 shrink-0 snap-start animate-fade-in-up sm:w-44 lg:w-48"
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

                {row.books.length > 0 && (
                  <div className="flex snap-x gap-4 overflow-x-auto pb-4">
                    {row.books.map((book, index) => (
                      <div
                        key={book.id}
                        className="w-40 shrink-0 snap-start animate-fade-in-up sm:w-44 lg:w-48"
                        style={{ animationDelay: `${(index % 5) * 35}ms` }}
                      >
                        <BookCard variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
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
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-bit-muted">
              {error || `No ${selectedSubject} curriculum books are available yet.`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default CurriculumSubjectsPage;
