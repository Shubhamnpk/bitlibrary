import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Audiobook } from '@/types/index';
import {
  AUDIOBOOK_CATEGORIES,
  fetchAudiobooksByGenre,
  fetchInternetArchiveAudiobooks,
  fetchPopularAudiobooks,
  fetchProjectGutenbergAudiobooks,
  fetchYoBookAudiobooks,
  getAudiobookCategoryById,
  searchAudiobooks,
} from '@/services/audiobookService';
import AudiobookCard from '@/components/AudiobookCard';
import Seo from '@/components/Seo';
import { ArrowLeft, ArrowRight, Disc, Search, X } from 'lucide-react';
import { createItemListSchema } from '@/lib/seo';

interface AudiobooksPageProps {
  onAudiobookClick: (audiobook: Audiobook) => void;
}

type CategoryRows = Record<string, Audiobook[]>;

const AUDIOBOOK_ROW_LIMIT = 6;
const AUDIOBOOK_CATEGORY_LIMIT = 6;
const AUDIOBOOK_CATEGORY_BATCH_SIZE = 24;
const AUDIOBOOK_CATEGORY_MAX_LIMIT = 120;
const AUDIOBOOK_SEARCH_LIMIT = 6;

const AudiobooksPage: React.FC<AudiobooksPageProps> = ({ onAudiobookClick }) => {
  const { categoryId } = useParams();
  const selectedCategory = getAudiobookCategoryById(categoryId);
  const isCategoryPage = Boolean(categoryId);
  const [yoBookAudiobooks, setYoBookAudiobooks] = useState<Audiobook[]>([]);
  const [gutenbergAudiobooks, setGutenbergAudiobooks] = useState<Audiobook[]>([]);
  const [archiveAudiobooks, setArchiveAudiobooks] = useState<Audiobook[]>([]);
  const [featuredAudiobooks, setFeaturedAudiobooks] = useState<Audiobook[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRows>({});
  const [categoryAudiobooks, setCategoryAudiobooks] = useState<Audiobook[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Audiobook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [categoryRequest, setCategoryRequest] = useState({ categoryId: '', limit: AUDIOBOOK_CATEGORY_LIMIT });
  const [categoryLoadingMore, setCategoryLoadingMore] = useState(false);
  const currentCategoryLimit = selectedCategory && categoryRequest.categoryId === selectedCategory.id
    ? categoryRequest.limit
    : AUDIOBOOK_CATEGORY_LIMIT;

  useEffect(() => {
    let active = true;
    if (!selectedCategory || !categoryLoadingMore) setLoading(true);
    setSearchResults([]);
    setHasSearched(false);

    if (selectedCategory) {
      setYoBookAudiobooks([]);
      setGutenbergAudiobooks([]);
      setArchiveAudiobooks([]);
      fetchAudiobooksByGenre(selectedCategory.genre, currentCategoryLimit)
        .then((items) => {
          if (active) setCategoryAudiobooks(items);
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setCategoryLoadingMore(false);
          }
        });
      return () => {
        active = false;
      };
    }

    Promise.allSettled([
      fetchYoBookAudiobooks(AUDIOBOOK_ROW_LIMIT),
      fetchProjectGutenbergAudiobooks(AUDIOBOOK_ROW_LIMIT),
      fetchInternetArchiveAudiobooks(AUDIOBOOK_ROW_LIMIT),
      fetchPopularAudiobooks(AUDIOBOOK_ROW_LIMIT),
      ...AUDIOBOOK_CATEGORIES.map((category) => fetchAudiobooksByGenre(category.genre, AUDIOBOOK_ROW_LIMIT)),
    ])
      .then(([yoBookResult, gutenbergResult, archiveResult, featuredResult, ...rowResults]) => {
        if (!active) return;
        const yoBookItems = yoBookResult.status === 'fulfilled' ? yoBookResult.value : [];
        const gutenbergItems = gutenbergResult.status === 'fulfilled' ? gutenbergResult.value : [];
        const archiveItems = archiveResult.status === 'fulfilled' ? archiveResult.value : [];
        const featuredItems = featuredResult.status === 'fulfilled' ? featuredResult.value : [];
        setYoBookAudiobooks(yoBookItems);
        setGutenbergAudiobooks(gutenbergItems);
        setArchiveAudiobooks(archiveItems);
        setFeaturedAudiobooks(featuredItems);
        const nextRows = AUDIOBOOK_CATEGORIES.reduce<CategoryRows>((rows, category, index) => {
          const result = rowResults[index];
          rows[category.id] = result?.status === 'fulfilled' ? result.value : [];
          return rows;
        }, {});
        setCategoryRows(nextRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCategory, currentCategoryLimit]);

  const handleLoadMoreCategoryAudiobooks = () => {
    if (!selectedCategory) return;

    setCategoryLoadingMore(true);
    setCategoryRequest({
      categoryId: selectedCategory.id,
      limit: Math.min(currentCategoryLimit + AUDIOBOOK_CATEGORY_BATCH_SIZE, AUDIOBOOK_CATEGORY_MAX_LIMIT),
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    searchAudiobooks(trimmed, AUDIOBOOK_SEARCH_LIMIT)
      .then(setSearchResults)
      .finally(() => setSearching(false));
  };

  const schemaItems = isCategoryPage
    ? categoryAudiobooks
    : [...yoBookAudiobooks, ...gutenbergAudiobooks, ...archiveAudiobooks, ...featuredAudiobooks, ...Object.values(categoryRows).flat()];
  const schema = useMemo(
    () => createItemListSchema(
      schemaItems.slice(0, 24).map((item) => ({
        name: item.title,
        path: `/audiobook/${item.id}`,
        image: item.coverUrl,
      })),
      selectedCategory ? `${selectedCategory.label} audiobooks on BitLibrary` : 'Public-domain audiobooks on BitLibrary'
    ),
    [schemaItems, selectedCategory]
  );

  const pageTitle = selectedCategory ? `${selectedCategory.label} Audiobooks` : 'Audiobooks';
  const pageDescription = selectedCategory
    ? selectedCategory.description
    : 'Browse public-domain audiobooks by category, or search by title and author.';

  return (
    <div className="animate-fade-in pb-24">
      <Seo
        title={`${pageTitle} | BitLibrary`}
        description={selectedCategory ? `Listen to ${selectedCategory.label.toLowerCase()} audiobooks on BitLibrary.` : 'Browse and listen to audiobooks from YoBook and LibriVox inside BitLibrary.'}
        canonicalPath={selectedCategory ? `/audiobooks/category/${selectedCategory.id}` : '/audiobooks'}
        keywords={['YoBook audiobooks', 'LibriVox audiobooks', 'free audiobooks', selectedCategory?.label || 'audiobook categories'].filter(Boolean)}
        structuredData={[schema]}
      />

      <header className="mb-6 border-b border-bit-border pb-6 md:mb-8 md:pb-7">
        {isCategoryPage && (
          <Link to="/audiobooks" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-bit-muted transition-colors hover:text-bit-accent md:mb-5">
            <ArrowLeft size={14} />
            All audiobook categories
          </Link>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">
              {selectedCategory ? 'Category' : 'Listen by category'}
            </p>
            <h1 className="mt-2 text-2xl font-display font-bold text-bit-text md:text-4xl">{pageTitle}</h1>
            <p className="mt-3 hidden max-w-2xl text-sm leading-7 text-bit-muted sm:block">{pageDescription}</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full rounded-2xl border border-bit-border bg-bit-panel/35 p-2.5 lg:max-w-md md:p-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or author"
                className="min-w-0 flex-1 rounded-xl border border-bit-border bg-bit-bg/60 px-4 py-3 text-sm text-bit-text placeholder:text-bit-muted/60 focus:border-bit-accent/40 focus:outline-none"
              />
              <button className="inline-flex items-center justify-center rounded-xl bg-bit-accent px-4 py-3 text-white transition-transform active:scale-95" aria-label="Search audiobooks">
                {searching ? <Disc size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
          </form>
        </div>
      </header>

      {hasSearched && (
        <section className="mb-8 md:mb-10">
          <div className="mb-4 flex items-center justify-between gap-4 md:mb-5">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Search results</p>
              <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">{query.trim()}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchResults([]);
                setHasSearched(false);
                setQuery('');
              }}
              className="text-bit-muted transition-colors hover:text-bit-accent"
              aria-label="Clear search results"
            >
              <X size={16} />
            </button>
          </div>
          {searching ? (
            <AudiobookSkeletonGrid count={4} />
          ) : searchResults.length > 0 ? (
            <AudiobookGrid audiobooks={searchResults} onAudiobookClick={onAudiobookClick} />
          ) : (
            <div className="rounded-2xl border border-dashed border-bit-border bg-bit-panel/25 p-6 text-sm leading-6 text-bit-muted md:p-8 md:leading-7">
              No audiobooks found for that search. Try a title, author, or category name.
            </div>
          )}
        </section>
      )}

      {isCategoryPage ? (
        <section>
          {loading ? (
            <AudiobookSkeletonGrid count={8} />
          ) : selectedCategory ? (
            <>
              <AudiobookGrid audiobooks={categoryAudiobooks} onAudiobookClick={onAudiobookClick} />
              {currentCategoryLimit < AUDIOBOOK_CATEGORY_MAX_LIMIT && (
                <div className="mt-6 flex justify-center md:mt-10">
                  <button
                    type="button"
                    onClick={handleLoadMoreCategoryAudiobooks}
                    disabled={categoryLoadingMore}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-bit-accent/30 bg-bit-panel/50 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-bit-accent transition-all hover:border-bit-accent hover:bg-bit-accent hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {categoryLoadingMore ? <Disc size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    Load more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-bit-border bg-bit-panel/25 p-8 text-sm leading-7 text-bit-muted">
              This audiobook category was not found.
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-8 md:space-y-12">
          <CategoryQuickLinks />
          <AudiobookShelf
            title="Popular listening"
            description="Well-known classics and public-domain recordings people return to often."
            audiobooks={featuredAudiobooks}
            loading={loading}
            onAudiobookClick={onAudiobookClick}
          />
          <AudiobookShelf
            title="Project Gutenberg audio"
            description="Public-domain Gutenberg audio books with direct MP3 and Ogg tracks."
            audiobooks={gutenbergAudiobooks}
            loading={loading}
            onAudiobookClick={onAudiobookClick}
          />
          <AudiobookShelf
            title="Internet Archive playable audio"
            description="Archive audio records filtered to only items with playable MP3 or Ogg files."
            audiobooks={archiveAudiobooks}
            loading={loading}
            onAudiobookClick={onAudiobookClick}
          />
          {AUDIOBOOK_CATEGORIES.map((category) => (
            <AudiobookShelf
              key={category.id}
              title={category.label}
              description={category.description}
              audiobooks={categoryRows[category.id] || []}
              loading={loading}
              viewAllHref={`/audiobooks/category/${category.id}`}
              onAudiobookClick={onAudiobookClick}
            />
          ))}
          <AudiobookShelf
            title="YoBook education audio"
            description="Fast local-service learning audio from the YoBook education catalog."
            audiobooks={yoBookAudiobooks}
            loading={loading}
            onAudiobookClick={onAudiobookClick}
          />
        </section>
      )}
    </div>
  );
};

const CategoryQuickLinks = () => (
  <section>
    <p className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent md:mb-3">Browse categories</p>
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {AUDIOBOOK_CATEGORIES.map((category) => (
        <Link
          key={category.id}
          to={`/audiobooks/category/${category.id}`}
          className="shrink-0 rounded-full border border-bit-border bg-bit-panel/35 px-4 py-2 text-xs font-semibold text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          {category.label}
        </Link>
      ))}
    </div>
  </section>
);

interface AudiobookShelfProps {
  title: string;
  description: string;
  audiobooks: Audiobook[];
  loading: boolean;
  viewAllHref?: string;
  onAudiobookClick: (audiobook: Audiobook) => void;
}

const AudiobookShelf: React.FC<AudiobookShelfProps> = ({ title, description, audiobooks, loading, viewAllHref, onAudiobookClick }) => (
  <section>
    <div className="mb-4 flex items-center justify-between gap-3 md:mb-5 md:items-end md:gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-display font-bold text-bit-text md:text-2xl">{title}</h2>
        <p className="mt-1 hidden text-sm leading-6 text-bit-muted sm:block md:mt-2">{description}</p>
      </div>
      {viewAllHref && (
        <Link to={viewAllHref} className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold text-bit-accent transition-colors hover:text-bit-text md:gap-2 md:text-xs">
          View all
          <ArrowRight size={12} className="md:size-[14px]" />
        </Link>
      )}
    </div>

    {loading ? (
      <AudiobookSkeletonRow />
    ) : audiobooks.length > 0 ? (
      <div className="bit-card-grid">
        {audiobooks.slice(0, AUDIOBOOK_ROW_LIMIT).map((audiobook) => (
          <AudiobookCard key={audiobook.id} audiobook={audiobook} onClick={onAudiobookClick} variant="compact" />
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-bit-border bg-bit-panel/25 p-6 text-sm leading-7 text-bit-muted">
        This category is not available right now.
      </div>
    )}
  </section>
);

interface AudiobookGridProps {
  audiobooks: Audiobook[];
  onAudiobookClick: (audiobook: Audiobook) => void;
}

const AudiobookGrid: React.FC<AudiobookGridProps> = ({ audiobooks, onAudiobookClick }) => (
  <div className="bit-card-grid">
    {audiobooks.map((audiobook) => (
      <AudiobookCard key={audiobook.id} audiobook={audiobook} onClick={onAudiobookClick} variant="compact" />
    ))}
  </div>
);

const AudiobookSkeletonRow = () => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
    {Array.from({ length: AUDIOBOOK_ROW_LIMIT }).map((_, index) => (
      <div key={index} className="h-[18rem] rounded-xl border border-bit-border bg-bit-panel/30 animate-shimmer" />
    ))}
  </div>
);

const AudiobookSkeletonGrid = ({ count }: { count: number }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4 md:gap-x-6 md:gap-y-10">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="h-[22rem] rounded-xl border border-bit-border bg-bit-panel/30 animate-shimmer" />
    ))}
  </div>
);

export default AudiobooksPage;
