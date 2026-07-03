import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, Clock, BookOpen, Share2,
  Tag, Sparkles, Check, Library, Star, TrendingUp, Hash, ListTree, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Seo from '@/components/Seo';
import BookSuggestionCard from '@/components/BookSuggestionCard';
import BlogTableOfContents from '@/components/BlogTableOfContents';
import { createBreadcrumbSchema, createFaqSchema, toAbsoluteUrl, truncate } from '@/lib/seo';
import blogPosts from '@/content/blog.json';

const parseToc = (content: string) => {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const items: Array<{ id: string; text: string; level: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    items.push({ id, text, level });
  }
  return items;
};

const BlogPostPage: React.FC = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = blogPosts.find((p) => p.slug === slug);
  const currentIndex = blogPosts.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null;
  const relatedPosts = blogPosts
    .filter((p) => p.slug !== slug)
    .filter((p) => p.tags.some((t) => post?.tags.includes(t)))
    .slice(0, 3);

  const [copied, setCopied] = React.useState(false);
  const [tocOpen, setTocOpen] = React.useState(false);
  const tocItems = post ? parseToc(post.content) : [];

  const handleShare = async () => {
    const url = `${window.location.origin}/blog/${post?.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.title, text: post?.description, url });
      } catch { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', `#${id}`);
    }
    setTocOpen(false);
  };

  if (!post) {
    return (
      <div className="animate-fade-in pb-24 text-center py-24">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-bit-muted">Blog post not found.</p>
          <Link to="/blog" className="mt-6 inline-flex items-center gap-2 rounded-full bg-bit-accent px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white">
            <ArrowLeft size={14} /> Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createHeading = (level: number): any => {
    const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
    return (props: Record<string, unknown>) => {
      const content = props.children;
      const text = typeof content === 'string' ? content : '';
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return <HeadingTag id={id} {...props}>{content as React.ReactNode}</HeadingTag>;
    };
  };

  return (
    <div className="animate-fade-in pb-24">
      <Seo
        title={`${post.title} | BitLibrary Blog`}
        description={truncate(post.description, 158)}
        canonicalPath={`/blog/${post.slug}`}
        image={post.heroImage}
        type="article"
        publishedTime={post.publishedDate}
        keywords={post.tags}
        structuredData={[
          createBreadcrumbSchema([
            { name: 'BitLibrary', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.description,
            author: { '@type': 'Organization', name: post.author },
            datePublished: post.publishedDate,
            image: toAbsoluteUrl(post.heroImage || '/assets/bitlibrary-og.png'),
            publisher: {
              '@type': 'Organization',
              name: 'BitLibrary',
              logo: { '@type': 'ImageObject', url: toAbsoluteUrl('/assets/bitlibrary-logo.svg') },
            },
            mainEntityOfPage: { '@type': 'WebPage', '@id': toAbsoluteUrl(`/blog/${post.slug}`) },
          },
          createFaqSchema([
            { question: `What is ${post.title}?`, answer: truncate(post.description, 250) },
            { question: `Where can I find more resources about ${post.tags[0] || 'this topic'}?`, answer: `BitLibrary offers free access to books, audiobooks, and educational resources related to this topic. Visit the library or search for specific titles.` },
          ]),
        ]}
      />

      <div className="max-w-6xl mx-auto">
        {/* Back + ToC button (mobile) + Share */}
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate('/blog')}
            className="inline-flex items-center gap-1.5 rounded-full border border-bit-border bg-bit-panel/30 px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent font-bold shadow-sm"
          >
            <ArrowLeft size={12} />
            All Guides
          </button>
          <div className="flex items-center gap-1.5">
          
            {tocItems.length >= 2 && (
              <button
                onClick={() => setTocOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-bit-border bg-bit-panel/30 px-3 py-2 text-[9px] font-mono text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent lg:hidden"
              >
                <ListTree size={13} />
                Contents
              </button>
            )}
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-4 py-2.5 text-[10px] font-mono text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Share2 size={12} />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-10">
          {/* Main Content */}
          <article className="min-w-0">
            {/* Hero */}
            {post.heroImage && (
              <div className="relative h-56 md:h-72 rounded-3xl overflow-hidden border border-bit-border/50 mb-8">
                <img
                  src={post.heroImage}
                  alt={post.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bit-bg via-bit-bg/40 to-transparent" />
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-bit-muted mb-4">
              <span className="flex items-center gap-1"><Calendar size={11} />{post.publishedDate}</span>
              <span className="text-bit-muted/30">/</span>
              <span className="flex items-center gap-1"><Clock size={11} />{post.readingTime}</span>
              <span className="text-bit-muted/30">/</span>
              <span className="flex items-center gap-1"><BookOpen size={11} />{post.author}</span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-display font-bold text-bit-text tracking-tight leading-tight mb-6">
              {post.title}
            </h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-10">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-bit-accent/15 bg-bit-accent/5 px-3 py-1 text-[8px] font-mono uppercase tracking-widest text-bit-accent hover:bg-bit-accent hover:text-white transition-all"
                >
                  <Hash size={9} />
                  {tag}
                </Link>
              ))}
            </div>

            {/* Rich Content with ReactMarkdown */}
            <div className="prose prose-bit max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: createHeading(2),
                  h3: createHeading(3),
                  h4: createHeading(4),
                  a: ({ href, children, ...props }) => {
                    const isExternal = href?.startsWith('http');
                    if (isExternal) {
                      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                    }
                    if (href?.startsWith('/')) {
                      return <Link to={href} {...props}>{children}</Link>;
                    }
                    return <a href={href} {...props}>{children}</a>;
                  },
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {/* Book Suggestions Section */}
            {post.suggestedBooks && post.suggestedBooks.length > 0 && (
              <section className="mt-14 rounded-3xl border border-bit-border bg-gradient-to-br from-bit-panel/40 to-bit-panel/20 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-bit-accent font-bold">Related books on BitLibrary</p>
                    <h2 className="text-xl font-display font-bold text-bit-text">Books mentioned in this guide</h2>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {post.suggestedBooks.map((book) => (
                    <BookSuggestionCard key={book.id} book={book} />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link
                    to="/library"
                    className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-5 py-2.5 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-accent hover:border-bit-accent/30 transition-all"
                  >
                    Browse full library <ArrowRight size={12} />
                  </Link>
                </div>
              </section>
            )}

            {/* Prev / Next */}
            <div className="mt-12 pt-8 border-t border-bit-border grid grid-cols-2 gap-4">
              {prevPost ? (
                <Link
                  to={`/blog/${prevPost.slug}`}
                  className="group flex flex-col gap-1 rounded-xl border border-bit-border bg-bit-panel/20 p-4 hover:border-bit-accent/30 transition-all"
                >
                  <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-bit-muted/50">
                    <ArrowLeft size={10} /> Previous
                  </span>
                  <span className="text-sm font-display font-semibold text-bit-text line-clamp-1 group-hover:text-bit-accent transition-colors">
                    {prevPost.title}
                  </span>
                </Link>
              ) : <div />}
              {nextPost ? (
                <Link
                  to={`/blog/${nextPost.slug}`}
                  className="group flex flex-col gap-1 rounded-xl border border-bit-border bg-bit-panel/20 p-4 hover:border-bit-accent/30 transition-all text-right"
                >
                  <span className="flex items-center justify-end gap-1 text-[9px] font-mono uppercase tracking-widest text-bit-muted/50">
                    Next <ArrowRight size={10} />
                  </span>
                  <span className="text-sm font-display font-semibold text-bit-text line-clamp-1 group-hover:text-bit-accent transition-colors">
                    {nextPost.title}
                  </span>
                </Link>
              ) : <div />}
            </div>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <section className="mt-12">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp size={16} className="text-bit-accent" />
                  <h2 className="text-xl font-display font-bold text-bit-text">Related guides</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {relatedPosts.map((rp) => (
                    <Link
                      key={rp.slug}
                      to={`/blog/${rp.slug}`}
                      className="group rounded-xl border border-bit-border bg-bit-panel/20 p-4 hover:border-bit-accent/30 transition-all"
                    >
                      <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted/50 mb-2">{rp.publishedDate}</p>
                      <h3 className="text-sm font-display font-semibold text-bit-text group-hover:text-bit-accent transition-colors line-clamp-2 leading-snug">
                        {rp.title}
                      </h3>
                      <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-bit-accent opacity-0 group-hover:opacity-100 transition-all">
                        Read <ArrowRight size={10} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* CTA */}
            <div className="mt-12 rounded-3xl border border-bit-accent/20 bg-gradient-to-br from-bit-accent/5 to-transparent p-8 md:p-10 text-center">
              <Library size={28} className="mx-auto mb-4 text-bit-accent" />
              <h2 className="text-2xl md:text-3xl font-display font-bold text-bit-text">Discover books on BitLibrary</h2>
              <p className="mt-3 text-sm leading-relaxed text-bit-muted max-w-lg mx-auto">
                Explore thousands of free public domain books, audiobooks, and educational resources in our open digital library.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/library"
                  className="inline-flex items-center gap-2 rounded-full bg-bit-accent px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-white transition-all hover:scale-105"
                >
                  Browse Library <ArrowRight size={12} />
                </Link>
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/40 px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-bit-muted hover:text-bit-accent hover:border-bit-accent/30 transition-all"
                >
                  Search books
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block space-y-6">
            <BlogTableOfContents content={post.content} />

            {post.suggestedBooks && post.suggestedBooks.length > 0 && (
              <div className="rounded-2xl border border-bit-border bg-bit-panel/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen size={14} className="text-bit-accent" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-bit-accent font-bold">Books in this guide</span>
                </div>
                <div className="space-y-3">
                  {post.suggestedBooks.slice(0, 3).map((book) => (
                    <BookSuggestionCard key={book.id} book={book} />
                  ))}
                </div>
                {post.suggestedBooks.length > 3 && (
                  <p className="mt-3 text-[9px] font-mono text-bit-muted/50 text-center">
                    +{post.suggestedBooks.length - 3} more books
                  </p>
                )}
              </div>
            )}

            {relatedPosts.length > 0 && (
              <div className="rounded-2xl border border-bit-border bg-bit-panel/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-bit-accent" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-bit-accent font-bold">Related</span>
                </div>
                <div className="space-y-3">
                  {relatedPosts.map((rp) => (
                    <Link
                      key={rp.slug}
                      to={`/blog/${rp.slug}`}
                      className="block group"
                    >
                      <p className="text-[11px] font-display font-semibold text-bit-text group-hover:text-bit-accent transition-colors leading-snug line-clamp-2">
                        {rp.title}
                      </p>
                      <p className="mt-1 text-[9px] font-mono text-bit-muted/50 uppercase tracking-widest">{rp.readingTime}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {tocOpen && (
        <div className="fixed inset-0 z-[10200] flex flex-col bg-bit-bg lg:hidden">
          <div className="flex items-center justify-between border-b border-bit-border px-4 py-3">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-bit-muted">On this page</p>
            <button
              type="button"
              onClick={() => setTocOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-bit-border text-bit-muted"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToHeading(item.id)}
                  className="block w-full rounded-xl border border-bit-border bg-bit-panel/30 px-3.5 py-2.5 text-left text-sm font-semibold text-bit-text transition-all hover:border-bit-accent/30 hover:text-bit-accent active:scale-[0.98]"
                  style={{ paddingLeft: `${12 + (item.level - 2) * 16}px` }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogPostPage;
