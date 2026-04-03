import React from 'react';
import { Zap, Info, BookOpen } from 'lucide-react';

export const BookCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-bit-border bg-bit-panel/30 overflow-hidden animate-pulse shadow-sm">
    <div className="aspect-[4/5] bg-bit-panel/50" />
    <div className="p-5 space-y-4">
      <div className="h-4 bg-bit-panel/50 rounded w-3/4" />
      <div className="h-3 bg-bit-panel/30 rounded w-1/2" />
      <div className="flex gap-2 pt-2">
        <div className="h-9 bg-bit-panel/50 rounded-xl flex-1" />
        <div className="h-9 bg-bit-panel/50 rounded-xl w-12" />
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
  <div className="p-8 rounded-3xl bg-bit-panel/40 border border-bit-border mb-16 animate-pulse shadow-sm">
    <div className="flex items-start gap-4">
      <div className="p-2 bg-bit-panel/50 rounded-xl shrink-0 w-12 h-12 border border-bit-border" />
      <div className="space-y-3 w-full pt-1">
        <div className="h-3 bg-bit-panel/50 rounded w-24" />
        <div className="space-y-2">
          <div className="h-4 bg-bit-panel/40 rounded w-full" />
          <div className="h-4 bg-bit-panel/40 rounded w-5/6" />
        </div>
      </div>
    </div>
  </div>
);

export const BookDetailsSkeleton: React.FC = () => (
  <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6 pt-10">
    <div className="flex items-center justify-between mb-12 opacity-60">
      <div className="h-4 bg-bit-panel/50 rounded-full w-40" />
      <div className="h-10 bg-bit-panel/50 rounded-2xl w-32 border border-bit-border" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4 space-y-8">
        <div className="aspect-[2/3] rounded-3xl bg-bit-panel/40 animate-pulse shadow-xl border border-bit-border" />
        <div className="space-y-4">
          <div className="h-12 bg-bit-panel/50 rounded-2xl w-full border border-bit-border" />
          <div className="h-12 bg-bit-panel/50 rounded-2xl w-full border border-bit-border" />
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="mb-10 h-10 bg-bit-panel/40 rounded-2xl w-3/4 border border-bit-border" />
        <div className="mb-12 flex gap-8 border-b border-bit-border pb-6">
          <div className="h-4 bg-bit-panel/50 rounded w-32" />
          <div className="h-4 bg-bit-panel/50 rounded w-32" />
        </div>

        <section className="mb-12 space-y-6">
          <div className="flex items-center justify-between mb-10">
            <div className="h-8 bg-bit-panel/40 rounded-xl w-48" />
            <div className="h-12 bg-bit-accent/10 rounded-2xl w-40 border border-bit-accent/20" />
          </div>
          <div className="space-y-4">
            <div className="h-5 bg-bit-panel/30 rounded w-full" />
            <div className="h-5 bg-bit-panel/30 rounded w-11/12" />
            <div className="h-5 bg-bit-panel/30 rounded w-4/5" />
            <div className="h-5 bg-bit-panel/30 rounded w-full" />
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 bg-bit-panel/30 border border-bit-border rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  </div>
);
