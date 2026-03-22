import React from 'react';
import { Zap, Info, BookOpen } from 'lucide-react';

export const BookCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden animate-pulse">
    <div className="aspect-[4/5] bg-white/5" />
    <div className="p-5 space-y-4">
      <div className="h-4 bg-white/5 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-1/2" />
      <div className="flex gap-2 pt-2">
        <div className="h-8 bg-white/5 rounded-lg flex-1" />
        <div className="h-8 bg-white/5 rounded-lg w-12" />
      </div>
    </div>
  </div>
);

export const BookGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
    {Array.from({ length: count }).map((_, i) => (
      <BookCardSkeleton key={i} />
    ))}
  </div>
);

export const SearchInsightSkeleton: React.FC = () => (
  <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 mb-16 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="p-2 bg-white/5 rounded-lg shrink-0 w-10 h-10" />
      <div className="space-y-3 w-full">
        <div className="h-3 bg-white/5 rounded w-24" />
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded w-full" />
          <div className="h-4 bg-white/5 rounded w-5/6" />
        </div>
      </div>
    </div>
  </div>
);

export const BookDetailsSkeleton: React.FC = () => (
  <div className="animate-fade-in pb-20 max-w-7xl mx-auto px-6">
    <div className="flex items-center justify-between mb-8 opacity-40">
      <div className="h-4 bg-white/5 rounded w-32" />
      <div className="h-8 bg-white/5 rounded-full w-24" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4 space-y-8">
        <div className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse shadow-2xl" />
        <div className="space-y-4">
          <div className="h-10 bg-white/5 rounded-xl w-full" />
          <div className="h-10 bg-white/5 rounded-xl w-full" />
        </div>
      </div>

      <div className="lg:col-span-8">
        <div className="mb-10 h-10 bg-white/5 rounded w-1/2" />
        <div className="mb-12 flex gap-8 border-b border-white/5 pb-4">
          <div className="h-4 bg-white/5 rounded w-24" />
          <div className="h-4 bg-white/5 rounded w-24" />
        </div>

        <section className="mb-12 space-y-4">
          <div className="flex items-center justify-between mb-8">
            <div className="h-6 bg-white/5 rounded w-32" />
            <div className="h-10 bg-white/5 rounded-lg w-32" />
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-white/5 rounded w-full" />
            <div className="h-4 bg-white/5 rounded w-11/12" />
            <div className="h-4 bg-white/5 rounded w-4/5" />
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  </div>
);
