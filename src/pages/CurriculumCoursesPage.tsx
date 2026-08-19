import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookMarked, BookOpen, GraduationCap, LibraryBig, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Book } from '@/types/index';
import BookCard from '@/components/BookCard';
import { BookCardSkeleton } from '@/components/Skeletons';
import Seo from '@/components/Seo';
import { fetchYoBookBooksBySource, fetchYoBookTextbookCollection } from '@/services/bookService';
import { truncate } from '@/lib/seo';

interface CurriculumCoursesPageProps {
  onBookClick: (book: Book) => void;
  onRead: (book: Book) => void;
}

const COURSE_BG_CLASSES = [
  'from-blue-500/15 to-blue-600/5',
  'from-emerald-500/15 to-emerald-600/5',
  'from-violet-500/15 to-violet-600/5',
  'from-amber-500/15 to-amber-600/5',
  'from-rose-500/15 to-rose-600/5',
  'from-cyan-500/15 to-cyan-600/5',
  'from-orange-500/15 to-orange-600/5',
  'from-teal-500/15 to-teal-600/5',
  'from-pink-500/15 to-pink-600/5',
  'from-indigo-500/15 to-indigo-600/5',
];

const CurriculumCoursesPage: React.FC<CurriculumCoursesPageProps> = ({ onBookClick, onRead }) => {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [courseBooks, setCourseBooks] = useState<Record<string, Book[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const [textbookResult, courseResult] = await Promise.allSettled([
          fetchYoBookTextbookCollection(controller.signal),
          fetchYoBookBooksBySource('pustakalaya-course', 200, controller.signal),
        ]);

        if (!isMounted) return;

        const allBooks: Book[] = [];

        if (textbookResult.status === 'fulfilled') {
          Object.values(textbookResult.value.rows).forEach((books) => allBooks.push(...books));
          allBooks.push(...textbookResult.value.ungraded);
        }

        if (courseResult.status === 'fulfilled') {
          allBooks.push(...courseResult.value);
        }

        const grouped: Record<string, Book[]> = {};
        allBooks.forEach((book) => {
          const courseName = book.collection_name?.trim();
          if (courseName && courseName.length > 0) {
            if (!grouped[courseName]) grouped[courseName] = [];
            grouped[courseName].push(book);
          }
        });

        setCourseBooks(grouped);

        if (Object.keys(grouped).length === 0 && textbookResult.status === 'rejected' && courseResult.status === 'rejected') {
          setError('No course data available at this time.');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError('Failed to load course data.');
          setCourseBooks({});
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadCourses();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const courses = useMemo(() => {
    return Object.entries(courseBooks)
      .map(([name, books]) => ({ name, count: books.length, books }))
      .sort((a, b) => b.count - a.count);
  }, [courseBooks]);

  const selectedCourseData = useMemo(() => {
    if (!selectedCourse) return null;
    const data = courseBooks[selectedCourse];
    return data ? { name: selectedCourse, books: data } : null;
  }, [selectedCourse, courseBooks]);

  const totalCourses = courses.length;

  return (
    <div className="animate-fade-in pb-20">
      <Seo
        title="Browse by Course | BitLibrary"
        description={truncate('Browse educational courses and collections available in the BitLibrary archive.', 155)}
        canonicalPath="/curriculum/courses"
        keywords={['browse by course', 'educational courses', 'BitLibrary courses']}
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
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em]">Browse by course</p>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold tracking-tight text-bit-text sm:text-5xl">Course Shelves</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted">
              Explore books organized by course or collection.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-4 py-3 text-xs font-mono uppercase tracking-widest text-bit-muted">
            <LibraryBig size={15} className="text-bit-accent" />
            {loading ? '...' : `${totalCourses} courses`}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="space-y-10">
          {[1, 2, 3].map((row) => (
            <div key={row} className="border-b border-bit-border/60 pb-10">
              <div className="mb-4 h-7 w-48 animate-shimmer rounded bg-bit-panel/40" />
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
      ) : selectedCourseData ? (
        <section>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-accent">{selectedCourseData.name}</p>
              <h2 className="mt-2 text-3xl font-display font-bold tracking-tight text-bit-text">Books in this course</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCourse(null)}
              className="text-[10px] font-mono font-bold uppercase tracking-widest text-bit-accent hover:text-bit-text transition-all"
            >
              Back to courses
            </button>
          </div>

          {selectedCourseData.books.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {selectedCourseData.books.map((book) => (
                <BookCard key={book.id} variant="compact" book={book} onClick={onBookClick} onRead={onRead} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-bit-border bg-bit-panel/20 px-6 py-20 text-center">
              <BookOpen size={38} className="mx-auto mb-5 text-bit-border" />
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-bit-muted">No books found for this course.</p>
            </div>
          )}
        </section>
      ) : courses.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {courses.map((course, index) => (
            <button
              key={course.name}
              type="button"
              onClick={() => setSelectedCourse(course.name)}
              className="group flex min-h-32 flex-col justify-between rounded-lg border border-bit-border bg-bit-panel/20 p-4 text-left transition-all hover:border-bit-accent/50 hover:bg-bit-panel/40"
            >
              <span className="flex items-center justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${COURSE_BG_CLASSES[index % COURSE_BG_CLASSES.length]}`}>
                  <ScrollText size={20} className="text-bit-accent" />
                </span>
                <ArrowRight size={16} className="text-bit-muted transition-transform group-hover:translate-x-0.5" />
              </span>
              <span>
                <span className="block text-sm font-display font-bold leading-tight text-bit-text">{course.name}</span>
                <span className="mt-2 block text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
                  {course.count} {course.count === 1 ? 'book' : 'books'}
                </span>
              </span>
            </button>
          ))}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-bit-border bg-bit-panel/20 px-6 py-20 text-center">
          <BookOpen size={38} className="mx-auto mb-5 text-bit-border" />
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-bit-muted">
            {error || 'No courses are available yet.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CurriculumCoursesPage;