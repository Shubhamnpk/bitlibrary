import React from 'react';

const SkeletonBlock = ({ className = "", ...props }: { className?: string; [key: string]: any }) => (
  <div className={`animate-shimmer bg-bit-panel/40 border border-bit-border/30 rounded ${className}`} {...props} />
);

export const BookCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-bit-border/50 bg-bit-panel/20 overflow-hidden shadow-sm flex flex-col h-full">
    <div className="aspect-[4/5] w-full animate-shimmer bg-bit-panel/40" />
    <div className="p-5 flex flex-col flex-1 space-y-4">
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
      </div>
      <div className="mt-auto flex gap-2 pt-2">
        <SkeletonBlock className="h-9 rounded-xl flex-1" />
        <SkeletonBlock className="h-9 rounded-xl w-12" />
      </div>
    </div>
  </div>
);

export const BookGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 md:gap-x-6 md:gap-y-12">
    {Array.from({ length: count }).map((_, i) => (
      <BookCardSkeleton key={i} />
    ))}
  </div>
);

export const SearchInsightSkeleton: React.FC = () => (
  <div className="p-8 rounded-3xl bg-bit-panel/30 border border-bit-border/50 mb-16 shadow-sm overflow-hidden relative">
    <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
    <div className="flex items-start gap-4 relative z-10">
      <SkeletonBlock className="w-12 h-12 rounded-xl shrink-0" />
      <div className="space-y-3 w-full pt-1">
        <SkeletonBlock className="h-3 w-24" />
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  </div>
);

export const BookDetailsSkeleton: React.FC = () => (
  <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
    <div className="flex items-center justify-between mb-12">
      <SkeletonBlock className="h-4 w-40 rounded-full" />
      <SkeletonBlock className="h-10 w-32 rounded-2xl" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4 space-y-8">
        <div className="aspect-[2/3] rounded-3xl animate-shimmer bg-bit-panel/30 shadow-xl border border-bit-border/50" />
        <div className="space-y-4">
          <SkeletonBlock className="h-12 rounded-2xl w-full" />
          <SkeletonBlock className="h-12 rounded-2xl w-full" />
        </div>
      </div>

      <div className="lg:col-span-8">
        <SkeletonBlock className="mb-10 h-10 rounded-2xl w-3/4" />
        <div className="mb-12 flex gap-8 border-b border-bit-border/30 pb-6">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-32" />
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex items-center justify-between mb-10">
            <SkeletonBlock className="h-8 rounded-xl w-48" />
            <SkeletonBlock className="h-12 rounded-2xl w-40 border-bit-accent/20" />
          </div>
          <div className="space-y-4">
            <SkeletonBlock className="h-5 w-full" />
            <SkeletonBlock className="h-5 w-11/12" />
            <SkeletonBlock className="h-5 w-4/5" />
            <SkeletonBlock className="h-5 w-full" />
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[1,2,3,4].map(i => (
            <SkeletonBlock key={i} className="h-28 rounded-2xl shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  </div>
);
