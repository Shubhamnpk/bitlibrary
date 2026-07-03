import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, BookOpen, Search, Tag, TrendingUp, Sparkles, BookMarked, ChevronLeft, ChevronRight } from 'lucide-react';
import Seo from '@/components/Seo';
import { createBreadcrumbSchema, createItemListSchema } from '@/lib/seo';
import blogPosts from '@/content/blog.json';

const ALL_TAGS = Array.from(new Set(blogPosts.flatMap((p) => p.tags))).sort();
const POSTS_PER_PAGE = 9;

const BlogPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [activeTag, setActiveTag] = useState<string | null>(searchParams.get('tag') || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPosts = useMemo(() => {
    return blogPosts.filter((post) => {
      if (activeTag && !post.tags.includes(activeTag)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          post.title.toLowerCase().includes(q) ||
          post.description.toLowerCase().includes(q) ||
          post.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [activeTag, searchQuery]);

  const featuredPost = filteredPosts[0];
  const displayPosts = useMemo(() => {
    const posts = featuredPost && !activeTag && !searchQuery ? filteredPosts.slice(1) : filteredPosts;
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    return posts.slice(start, start + POSTS_PER_PAGE);
  }, [filteredPosts, featuredPost, activeTag, searchQuery, currentPage]);

  const totalPages = useMemo(() => {
    const count = featuredPost && !activeTag && !searchQuery ? filteredPosts.length - 1 : filteredPosts.length;
    return Math.max(1, Math.ceil(count / POSTS_PER_PAGE));
  }, [filteredPosts, featuredPost, activeTag, searchQuery]);

  const showFeatured = featuredPost && !activeTag && !searchQuery && currentPage === 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTag, searchQuery]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="animate-fade-in pb-24">
      <Seo
        title="BitLibrary Blog: Guides on Public Domain Books, Free Audiobooks, and Digital Reading"
        description="Read guides on public domain books, free audiobooks, Nepal education curriculum, digital libraries, and open educational resources. Learn how to read books online for free."
        canonicalPath="/blog"
        keywords={[
          'BitLibrary blog', 'digital library guide', 'public domain books guide',
          'free audiobooks guide', 'Nepal education blog', 'read books online guide',
          'open digital library blog', 'free ebooks blog',
        ]}
        structuredData={[
          createBreadcrumbSchema([
            { name: 'BitLibrary', path: '/' },
            { name: 'Blog', path: '/blog' },
          ]),
          createItemListSchema(
            blogPosts.map((post) => ({
              name: post.title,
              path: `/blog/${post.slug}`,
            })),
            'BitLibrary Blog Posts'
          ),
        ]}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10 md:mb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-bit-accent/20 bg-bit-accent/5 px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-bit-accent">
              <BookOpen size={12} />
              BitLibrary Blog
            </span>
            <span className="text-[10px] font-mono text-bit-muted/50 uppercase tracking-widest">
              {blogPosts.length} guides
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-bit-text tracking-tight leading-[0.95]">
            Guides & <span className="bg-gradient-to-r from-bit-text via-bit-text to-bit-accent bg-clip-text text-transparent"> resources</span>
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-bit-muted max-w-2xl">
            Learn about public domain books, free audiobooks, the Nepal education curriculum,
            digital libraries, and how to make the most of open reading resources.
          </p>
        </div>

        {/* Search + Filter */}
        <div className="mb-10 space-y-4">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-bit-muted/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-bit-border bg-bit-panel/30 text-sm text-bit-text placeholder:text-bit-muted/40 focus:outline-none focus:border-bit-accent/40 transition-all font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all border ${
                !activeTag
                  ? 'bg-bit-accent text-white border-bit-accent'
                  : 'bg-bit-panel/30 text-bit-muted border-bit-border hover:border-bit-accent/30 hover:text-bit-accent'
              }`}
            >
              All
            </button>
            {ALL_TAGS.slice(0, 12).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all border ${
                  activeTag === tag
                    ? 'bg-bit-accent text-white border-bit-accent'
                    : 'bg-bit-panel/30 text-bit-muted border-bit-border hover:border-bit-accent/30 hover:text-bit-accent'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Hero Post */}
        {featuredPost && !activeTag && !searchQuery && (
          <Link
            to={`/blog/${featuredPost.slug}`}
            className="group block mb-12 relative overflow-hidden rounded-3xl border border-bit-border bg-gradient-to-br from-bit-panel/40 via-bit-panel/20 to-transparent hover:border-bit-accent/30 transition-all"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--bit-accent-rgb),0.08),transparent_50%)] pointer-events-none" />
            <div className="grid md:grid-cols-5 gap-6 p-6 md:p-10">
              {featuredPost.heroImage && (
                <div className="md:col-span-2 relative h-48 md:h-full min-h-[12rem] rounded-2xl overflow-hidden border border-bit-border/50">
                  <img
                    src={featuredPost.heroImage}
                    alt={featuredPost.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bit-bg via-transparent to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-bit-accent/90 px-3 py-1 text-[8px] font-mono uppercase tracking-widest text-white font-bold">
                      <Sparkles size={10} />
                      Featured
                    </span>
                  </div>
                </div>
              )}
              <div className={`${featuredPost.heroImage ? 'md:col-span-3' : 'md:col-span-5'} flex flex-col justify-center`}>
                <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-bit-muted mb-3">
                  <span className="flex items-center gap-1"><Calendar size={11} />{featuredPost.publishedDate}</span>
                  <span className="text-bit-muted/30">/</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{featuredPost.readingTime}</span>
                </div>
                <h2 className="text-2xl md:text-4xl font-display font-bold text-bit-text group-hover:text-bit-accent transition-colors tracking-tight leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="mt-4 text-sm md:text-base leading-relaxed text-bit-muted line-clamp-2">
                  {featuredPost.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {featuredPost.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-bit-border bg-bit-panel/40 px-3 py-1 text-[8px] font-mono uppercase tracking-widest text-bit-muted">
                      <Tag size={9} />{tag}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-bit-accent group-hover:gap-3 transition-all">
                  Read guide <ArrowRight size={12} />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Post Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayPosts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-bit-border bg-bit-panel/30 overflow-hidden transition-all hover:-translate-y-1 hover:border-bit-accent/30 hover:bg-bit-panel/40 hover:shadow-lg hover:shadow-bit-accent/5"
            >
              {post.heroImage && (
                <div className="relative h-40 overflow-hidden border-b border-bit-border/50">
                  <img
                    src={post.heroImage}
                    alt={post.title}
                    className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-700 group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bit-bg via-transparent to-transparent" />
                </div>
              )}
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-bit-muted mb-3">
                  <Calendar size={10} />
                  {post.publishedDate}
                  <span className="text-bit-muted/30">/</span>
                  <Clock size={10} />
                  {post.readingTime}
                </div>
                <h2 className="text-lg font-display font-bold text-bit-text group-hover:text-bit-accent transition-colors leading-snug line-clamp-2">
                  {post.title}
                </h2>
                <p className="mt-3 text-xs leading-relaxed text-bit-muted line-clamp-2">
                  {post.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="inline-block rounded-full border border-bit-border bg-bit-panel/40 px-2.5 py-0.5 text-[7px] font-mono uppercase tracking-widest text-bit-muted/70">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-bit-accent opacity-0 group-hover:opacity-100 transition-all">
                  Read more <ArrowRight size={10} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => goToPage(currentPage - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-bit-border bg-bit-panel/30 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-mono font-bold transition-all ${
                      page === currentPage
                        ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20'
                        : 'border-bit-border bg-bit-panel/30 text-bit-muted hover:border-bit-accent/30 hover:text-bit-accent'
                    }`}
                  >
                    {page}
                  </button>
                );
              }
              if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <span key={page} className="flex h-10 w-6 items-center justify-center text-bit-muted/30 font-mono text-xs">
                    ...
                  </span>
                );
              }
              return null;
            })}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => goToPage(currentPage + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-bit-border bg-bit-panel/30 text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Empty State */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-20">
            <BookMarked size={40} className="mx-auto mb-4 text-bit-muted/30" />
            <p className="font-mono text-sm text-bit-muted/60 uppercase tracking-widest">No guides match your search</p>
            <button
              onClick={() => { setActiveTag(null); setSearchQuery(''); }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-bit-accent px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white transition-all hover:scale-105"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Newsletter / CTA */}
        <div className="mt-16 rounded-3xl border border-bit-accent/20 bg-gradient-to-br from-bit-accent/5 to-transparent p-8 md:p-12 text-center">
          <TrendingUp size={24} className="mx-auto mb-4 text-bit-accent" />
          <h2 className="text-2xl md:text-3xl font-display font-bold text-bit-text">Explore the library</h2>
          <p className="mt-3 text-sm leading-relaxed text-bit-muted max-w-lg mx-auto">
            Put these guides into practice — browse thousands of free public domain books, audiobooks, and educational resources.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/library"
              className="inline-flex items-center gap-2 rounded-full bg-bit-accent px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white transition-all hover:scale-105"
            >
              Browse Library <ArrowRight size={12} />
            </Link>
            <Link
              to="/curriculum"
              className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-accent hover:border-bit-accent/30 transition-all"
            >
              Curriculum Books
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogPage;
