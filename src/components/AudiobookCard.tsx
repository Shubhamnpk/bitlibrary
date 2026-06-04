import React from 'react';
import { Audiobook } from '@/types/index';
import { Bookmark, Clock3, Headphones, ListMusic, Play } from 'lucide-react';
import { toggleSavedAudiobook, useLocalUserState } from '@/lib/local-user';
import { HighlightedText } from './HighlightedText';

interface AudiobookCardProps {
  audiobook: Audiobook;
  onClick: (audiobook: Audiobook) => void;
  variant?: 'compact' | 'full';
  searchQuery?: string;
}

const formatDuration = (seconds?: number, fallback?: string) => {
  if (fallback) return fallback;
  if (!seconds) return 'Open audio';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const AudiobookCard: React.FC<AudiobookCardProps> = ({ audiobook, onClick, variant = 'full', searchQuery }) => {
  const { state } = useLocalUserState();
  const isSaved = state.savedAudiobooks.some((entry) => entry.id === audiobook.id);
  const coverUrl = audiobook.thumbnailUrl || audiobook.coverUrl;
  const proxiedCoverUrl = coverUrl
    ? `https://images.weserv.nl/?url=${encodeURIComponent(coverUrl)}&w=360&h=480&fit=cover&output=webp`
    : null;
  const isCompact = variant === 'compact';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(audiobook)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(audiobook);
        }
      }}
      className={`group relative flex h-full w-full flex-col overflow-hidden border border-bit-border bg-bit-panel/30 text-left transition-all duration-300 hover:-translate-y-1 hover:border-bit-accent/30 hover:bg-bit-panel/50 ${isCompact ? 'rounded-lg' : 'rounded-xl shadow-sm'}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(var(--bit-accent-rgb),0.14),transparent_45%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className={`relative w-full overflow-hidden border-b border-bit-border bg-bit-panel/40 ${isCompact ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}>
        {proxiedCoverUrl ? (
          <img
            src={proxiedCoverUrl}
            alt={audiobook.title}
            loading="lazy"
            className="h-full w-full object-cover opacity-80 transition-all duration-[3s] ease-out group-hover:scale-110 group-hover:opacity-100"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(var(--bit-accent-rgb),0.14),transparent_55%)]">
            <Headphones size={44} className="text-bit-accent/70" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-bit-bg/85 via-transparent to-transparent" />
        <div className={`absolute rounded border border-bit-border bg-bit-panel/85 font-mono uppercase tracking-widest text-bit-accent backdrop-blur-md ${isCompact ? 'left-2 top-2 px-1.5 py-0.5 text-[8px]' : 'left-3 top-3 px-2 py-1 text-[9px]'}`}>
          {audiobook.source}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleSavedAudiobook(audiobook);
          }}
          className={`absolute z-20 rounded-full border backdrop-blur-md flex items-center justify-center transition-all active:scale-95 ${
            isSaved
              ? 'bg-bit-accent text-white border-bit-accent shadow-lg shadow-bit-accent/30'
              : 'bg-bit-panel/80 text-bit-muted border-bit-border hover:border-bit-accent hover:text-bit-accent'
          } ${isCompact ? 'right-2 top-2 h-8 w-8' : 'right-3 top-3 h-9 w-9'}`}
          aria-label={isSaved ? 'Remove audiobook from favorites' : 'Save audiobook'}
        >
          <Bookmark size={isCompact ? 13 : 15} className={isSaved ? 'fill-current' : ''} />
        </button>
        <div className={`absolute flex items-center justify-between gap-2 ${isCompact ? 'bottom-2 left-2 right-2' : 'bottom-3 left-3 right-3'}`}>
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-bit-border bg-bit-panel/85 font-mono uppercase tracking-widest text-bit-muted backdrop-blur-md ${isCompact ? 'max-w-[calc(100%-2.25rem)] px-2 py-1 text-[8px]' : 'px-2.5 py-1 text-[9px]'}`}>
            <Clock3 size={isCompact ? 10 : 11} />
            {formatDuration(audiobook.totalTimeSeconds, audiobook.totalTime)}
          </span>
          <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-bit-accent text-white shadow-lg shadow-bit-accent/30 transition-transform group-hover:scale-110 ${isCompact ? 'h-8 w-8' : 'h-9 w-9'}`}>
            <Play size={isCompact ? 13 : 15} className="ml-0.5 fill-current" />
          </span>
        </div>
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bit-panel/80 opacity-0 backdrop-blur-[5px] transition-opacity duration-300 group-hover:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-xl bg-bit-accent px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/30">
            <Play size={15} className="fill-current" />
            Listen
          </span>
        </div>
      </div>

      <div className={`relative z-10 flex flex-1 flex-col ${isCompact ? 'p-3.5 sm:p-4' : 'p-5'}`}>
        <h3 className={`font-display font-bold leading-tight text-bit-text transition-colors group-hover:text-bit-accent ${isCompact ? 'line-clamp-2 text-sm' : 'text-base'}`}>
          <HighlightedText text={audiobook.title} query={searchQuery} />
        </h3>
        <p className={`mt-2 line-clamp-1 font-mono uppercase tracking-widest text-bit-muted/75 ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>
          By <HighlightedText text={audiobook.author} query={searchQuery} />
        </p>

        {!isCompact && (
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-bit-muted">
            {audiobook.description}
          </p>
        )}

        <div className={`mt-auto flex items-center justify-between gap-2 border-t border-bit-border font-mono uppercase tracking-widest text-bit-muted/60 ${isCompact ? 'pt-3 text-[8px]' : 'pt-4 text-[9px]'}`}>
          <span className="inline-flex items-center gap-1.5">
            <ListMusic size={isCompact ? 11 : 12} />
            {audiobook.numSections || audiobook.tracks.length} tracks
          </span>
          <span className="truncate">{audiobook.language}</span>
        </div>
      </div>
    </div>
  );
};

export default AudiobookCard;
