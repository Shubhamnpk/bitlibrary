import React from 'react';
import { BookMarked, BookOpen, BookText, Headphones, LayoutGrid, RotateCcw, Search, X } from 'lucide-react';
import { CURRICULUM_GRADES } from '@/constants';
import type { CurriculumRegion, ResourceMode } from '@/lib/curriculum';
import { modeLabels, regionLabels } from '@/lib/curriculum';
import AppSelect from '@/components/AppSelect';

interface MobileCurriculumFiltersProps {
  open: boolean;
  onClose: () => void;
  curriculumRegion: CurriculumRegion;
  setCurriculumRegion: (region: CurriculumRegion) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  resourceMode: ResourceMode;
  setResourceMode: (mode: ResourceMode) => void;
  selectedGrade: number | 'all';
  setSelectedGrade: (grade: number | 'all') => void;
  curriculumSubjects: string[];
  hasActiveFilters: boolean;
  onReset: () => void;
}

const MODE_ICONS: Record<ResourceMode, React.ReactNode> = {
  all: <LayoutGrid size={15} />,
  textbooks: <BookText size={15} />,
  audiobooks: <Headphones size={15} />,
  stories: <Search size={15} />,
  'teacher-guides': <BookMarked size={15} />,
};

const RESOURCE_MODES = Object.keys(modeLabels) as ResourceMode[];

const MobileCurriculumFilters: React.FC<MobileCurriculumFiltersProps> = ({
  open,
  onClose,
  curriculumRegion,
  setCurriculumRegion,
  selectedSubject,
  setSelectedSubject,
  resourceMode,
  setResourceMode,
  selectedGrade,
  setSelectedGrade,
  curriculumSubjects,
  hasActiveFilters,
  onReset,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true" aria-label="Curriculum filters">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border border-bit-border bg-bit-bg shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-bit-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bit-accent/10">
              <LayoutGrid size={14} className="text-bit-accent" />
            </div>
            <p className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-bit-text">Filters</p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-bit-border px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted transition-colors hover:border-bit-accent/50 hover:text-bit-text"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-bit-border text-bit-muted transition-colors hover:text-bit-text"
              aria-label="Close filters"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="mb-5">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
              <BookOpen size={12} className="text-bit-accent" />
              Resource type
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RESOURCE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setResourceMode(mode)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${
                    resourceMode === mode
                      ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20'
                      : 'border border-bit-border bg-bit-panel/20 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'
                  }`}
                >
                  {MODE_ICONS[mode]}
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
              <BookMarked size={12} className="text-bit-accent" />
              Board
            </p>
            <div className="flex gap-2">
              {(['all', 'nepal', 'ncert'] as CurriculumRegion[]).map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setCurriculumRegion(region)}
                  className={`flex-1 rounded-xl py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${
                    curriculumRegion === region
                      ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20'
                      : 'border border-bit-border bg-bit-panel/20 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'
                  }`}
                >
                  {regionLabels[region]}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
              <Search size={12} className="text-bit-accent" />
              Subject
            </p>
            <AppSelect
              value={selectedSubject}
              onChange={setSelectedSubject}
              options={[
                { value: 'all', label: 'All subjects' },
                ...curriculumSubjects.map((subject) => ({ value: subject, label: subject })),
              ]}
              className="w-full"
              size="md"
            />
          </div>

          <div className="mb-1">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-bit-muted">
              <LayoutGrid size={12} className="text-bit-accent" />
              Grade
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGrade('all')}
                className={`inline-flex h-11 w-14 items-center justify-center rounded-xl text-xs font-mono font-bold transition-all ${
                  selectedGrade === 'all'
                    ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20'
                    : 'border border-bit-border bg-bit-panel/20 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'
                }`}
              >
                All
              </button>
              {CURRICULUM_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={`inline-flex h-11 w-14 items-center justify-center rounded-xl text-sm font-mono font-bold transition-all ${
                    selectedGrade === grade
                      ? 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20'
                      : 'border border-bit-border bg-bit-panel/20 text-bit-muted hover:border-bit-accent/40 hover:text-bit-text'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-bit-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-bit-accent text-xs font-bold uppercase tracking-widest text-white shadow-sm shadow-bit-accent/20 transition-all active:scale-[0.98]"
          >
            Show results
          </button>
        </div>
      </section>
    </div>
  );
};

export default MobileCurriculumFilters;
