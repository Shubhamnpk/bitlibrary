import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink } from 'lucide-react';

interface SuggestedBook {
  id: string;
  title: string;
  author: string;
  category: string;
  coverUrl?: string;
}

interface BookSuggestionCardProps {
  book: SuggestedBook;
}

const PLACEHOLDER_COVERS = [
  'https://images.unsplash.com/photo-1543005127-d0d080007886?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1459499362902-55a20553e082?q=80&w=200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1474932430478-367dbb6832c1?q=80&w=200&auto=format&fit=crop',
];

const BookSuggestionCard = React.memo<BookSuggestionCardProps>(({ book }) => {
  const navigate = useNavigate();
  const coverSrc = book.coverUrl || PLACEHOLDER_COVERS[Math.abs(book.id.length) % PLACEHOLDER_COVERS.length];

  return (
    <button
      onClick={() => navigate(`/book/${book.id}`)}
      className="group flex items-start gap-4 rounded-xl border border-bit-border bg-bit-panel/30 p-4 text-left transition-all hover:-translate-y-1 hover:border-bit-accent/30 hover:bg-bit-panel/50 hover:shadow-lg hover:shadow-bit-accent/5 w-full"
    >
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-bit-border bg-bit-panel/50">
        <img
          src={coverSrc}
          alt={book.title}
          className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_COVERS[0];
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div>
          <p className="text-sm font-semibold text-bit-text line-clamp-2 group-hover:text-bit-accent transition-colors leading-snug">
            {book.title}
          </p>
          <p className="mt-1 text-[10px] font-mono text-bit-muted truncate">
            {book.author}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-bit-border bg-bit-panel/40 px-2 py-0.5 text-[8px] font-mono uppercase tracking-widest text-bit-muted/70">
            {book.category}
          </span>
          <BookOpen size={12} className="text-bit-accent/60 group-hover:text-bit-accent transition-colors ml-auto" />
        </div>
      </div>
    </button>
  );
});

export default BookSuggestionCard;
