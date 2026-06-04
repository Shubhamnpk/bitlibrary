import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronDown,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  Headphones,
  Library,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from 'lucide-react';
import Seo from '@/components/Seo';
import roadmapJson from '@/data/roadmap.json';

interface RoadmapPageProps {
  onBack: () => void;
}

type RoadmapStatus = 'done' | 'working' | 'next' | 'idea';
type RoadmapArea = 'Core' | 'Search' | 'Reader' | 'Audio' | 'YoBook' | 'Library' | 'Trust';
type IconKey = 'foundation' | 'search' | 'reader' | 'audio' | 'yobook' | 'library' | 'trust' | 'design' | 'sync';

interface RoadmapSubGoal {
  title: string;
  progress: number;
}

interface RoadmapGoal {
  id: string;
  title: string;
  area: RoadmapArea;
  icon: IconKey;
  version: string;
  summary: string;
  subGoals: RoadmapSubGoal[];
}

const roadmapDatabase = roadmapJson as { goals: RoadmapGoal[] };

const iconMap: Record<IconKey, typeof BookOpenText> = {
  foundation: BookOpenText,
  search: Search,
  reader: BookOpenText,
  audio: Headphones,
  yobook: Database,
  library: Library,
  trust: ShieldCheck,
  design: Palette,
  sync: Waypoints,
};

const statusMeta: Record<RoadmapStatus, {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
  barClassName: string;
}> = {
  done: {
    label: 'Done',
    icon: CheckCircle2,
    className: 'border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200',
    barClassName: 'bg-emerald-400 dark:bg-emerald-400',
  },
  working: {
    label: 'Working on',
    icon: Clock3,
    className: 'border-bit-accent/25 bg-bit-accent/8 text-bit-accent',
    barClassName: 'bg-bit-accent/80 dark:bg-bit-accent',
  },
  next: {
    label: 'Next',
    icon: CircleDashed,
    className: 'border-blue-500/30 bg-blue-100 text-blue-900 dark:border-sky-300/35 dark:bg-sky-300/15 dark:text-sky-100',
    barClassName: 'bg-blue-500 dark:bg-sky-300',
  },
  idea: {
    label: 'Idea',
    icon: Sparkles,
    className: 'border-fuchsia-500/25 bg-fuchsia-100 text-fuchsia-900 dark:border-violet-300/35 dark:bg-violet-300/15 dark:text-violet-100',
    barClassName: 'bg-fuchsia-500 dark:bg-violet-300',
  },
};

const principles = [
  'Prefer open and clearly licensed sources.',
  'Make useful workflows before adding decoration.',
  'Keep personal data local unless sync is intentionally added.',
  'Make books, audio, authors, curriculum, and subjects easy to move between.',
  'Treat reader comfort and search trust as core product quality.',
];

const statusFilters: Array<'active' | RoadmapStatus> = ['active', 'working', 'next', 'idea', 'done'];
const areaFilters: Array<'all' | RoadmapArea> = ['all', 'Core', 'Search', 'Reader', 'Audio', 'YoBook', 'Library', 'Trust'];

const getGoalProgress = (subGoals: RoadmapSubGoal[]) => {
  if (!subGoals.length) return 0;
  return Math.round(subGoals.reduce((total, subGoal) => total + subGoal.progress, 0) / subGoals.length);
};

const getGoalStatus = (progress: number): RoadmapStatus => {
  if (progress >= 100) return 'done';
  if (progress >= 50) return 'working';
  if (progress >= 10) return 'next';
  return 'idea';
};

const getMilestoneSortValue = (version: string) => {
  if (version === 'Future') return -1;
  const match = version.match(/v(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return 0;
  return Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
};

const CircularProgress = ({ value, label }: { value: number; label?: string }) => {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} className="fill-none stroke-bit-border" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="fill-none stroke-bit-accent transition-all"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <span className="absolute text-[9px] font-mono font-bold text-bit-text tabular-nums" aria-label={label || `${value}% complete`}>
        {value}
      </span>
    </span>
  );
};

const RoadmapPage: React.FC<RoadmapPageProps> = ({ onBack }) => {
  const [activeStatus, setActiveStatus] = useState<'active' | RoadmapStatus>('active');
  const [activeArea, setActiveArea] = useState<'all' | RoadmapArea>('all');
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});

  const filteredGoals = useMemo(() => (
    roadmapDatabase.goals.filter((goal) => {
      const computedStatus = getGoalStatus(getGoalProgress(goal.subGoals));
      const matchesStatus = activeStatus === 'active'
        ? computedStatus !== 'done'
        : computedStatus === activeStatus;
      return (
        matchesStatus &&
        (activeArea === 'all' || goal.area === activeArea)
      );
    })
  ), [activeArea, activeStatus]);

  const averageProgress = Math.round(
    roadmapDatabase.goals.reduce((total, goal) => total + getGoalProgress(goal.subGoals), 0) / roadmapDatabase.goals.length
  );
  const milestoneGroups = useMemo(() => {
    const groups = new Map<string, RoadmapGoal[]>();
    roadmapDatabase.goals.forEach((goal) => {
      groups.set(goal.version, [...(groups.get(goal.version) || []), goal]);
    });

    return Array.from(groups.entries())
      .map(([version, goals]) => {
        const progress = Math.round(goals.reduce((total, goal) => total + getGoalProgress(goal.subGoals), 0) / goals.length);
        const doneCount = goals.filter((goal) => getGoalStatus(getGoalProgress(goal.subGoals)) === 'done').length;
        return { version, goals, progress, doneCount };
      })
      .sort((a, b) => getMilestoneSortValue(b.version) - getMilestoneSortValue(a.version));
  }, []);

  const getStatusFilterCount = (status: 'active' | RoadmapStatus) => (
    roadmapDatabase.goals.filter((goal) => {
      const computedStatus = getGoalStatus(getGoalProgress(goal.subGoals));
      const matchesArea = activeArea === 'all' || goal.area === activeArea;
      const matchesStatus = status === 'active' ? computedStatus !== 'done' : computedStatus === status;
      return matchesArea && matchesStatus;
    }).length
  );

  const getAreaFilterCount = (area: 'all' | RoadmapArea) => (
    roadmapDatabase.goals.filter((goal) => {
      const computedStatus = getGoalStatus(getGoalProgress(goal.subGoals));
      const matchesStatus = activeStatus === 'active' ? computedStatus !== 'done' : computedStatus === activeStatus;
      const matchesArea = area === 'all' || goal.area === area;
      return matchesStatus && matchesArea;
    }).length
  );

  const toggleGoal = (goalId: string) => {
    setExpandedGoals((current) => ({
      ...current,
      [goalId]: !current[goalId],
    }));
  };

  return (
    <div className="animate-fade-in pb-24 pt-4 md:pt-6">
      <Seo
        title="Roadmap | BitLibrary"
        description="See BitLibrary roadmap goals, completed milestones, current progress, and future product ideas after v0.5.0."
        canonicalPath="/roadmap"
        keywords={['BitLibrary roadmap', 'digital library roadmap', 'reader study tools', 'YoBook search', 'open library planning']}
      />

      <div className="mx-auto max-w-6xl">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-bit-border bg-bit-panel/30 px-5 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <header className="mb-8 overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/25 p-5 md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-bit-accent">Roadmap Database</p>
              <h1 className="mt-3 text-3xl font-display font-bold text-bit-text md:text-5xl">Where BitLibrary is moving</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-bit-muted">
                A roadmap is our living progress board: finished milestones, active work, next goals, and ideas. Each goal has its own sub-goals and progress.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <CircularProgress value={averageProgress} label="Overall roadmap progress" />
              <Link
                to="/releases"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-bg/35 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent"
              >
                Releases
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-bit-border bg-bit-bg/25 p-3">
              <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted">Status filter</p>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveStatus(status)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-all ${activeStatus === status ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/35 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
                  >
                    <span>{status === 'active' ? 'Active' : status === 'done' ? 'Archive' : statusMeta[status].label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${activeStatus === status ? 'bg-white/20 text-white' : 'bg-bit-bg/50 text-bit-text'}`}>
                      {getStatusFilterCount(status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-bg/25 p-3">
              <p className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted">Source filter</p>
              <div className="flex flex-wrap gap-2">
                {areaFilters.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setActiveArea(area)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-all ${activeArea === area ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/35 text-bit-muted hover:border-bit-accent/40 hover:text-bit-accent'}`}
                  >
                    <span>{area}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${activeArea === area ? 'bg-white/20 text-white' : 'bg-bit-bg/50 text-bit-text'}`}>
                      {getAreaFilterCount(area)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <main className="space-y-8">
            <section className="space-y-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-bit-border bg-bit-panel/25 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-accent">
                  {activeStatus === 'done' ? 'Archive' : 'Active roadmap'}
                </p>
                <p className="mt-1 text-sm leading-6 text-bit-muted">
                  {activeStatus === 'done'
                    ? 'Completed goals are kept here for history.'
                    : 'Completed goals are hidden by default. Open Archive to see finished work.'}
                </p>
              </div>
              <span className="rounded-full border border-bit-border bg-bit-bg/35 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                {filteredGoals.length} shown
              </span>
            </div>
            {filteredGoals.map((goal) => {
              const goalProgress = getGoalProgress(goal.subGoals);
              const goalStatus = getGoalStatus(goalProgress);
              const meta = statusMeta[goalStatus];
              const StatusIcon = meta.icon;
              const GoalIcon = iconMap[goal.icon];
              const isExpanded = Boolean(expandedGoals[goal.id]);

              return (
                <article key={goal.id} className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5 transition-colors hover:border-bit-accent/25 md:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-bit-border bg-bit-bg/35 text-bit-accent">
                        <GoalIcon size={21} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] ${meta.className}`}>
                            <StatusIcon size={13} />
                            {meta.label}
                          </span>
                          <span className="rounded-full border border-bit-border bg-bit-bg/35 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                            {goal.area}
                          </span>
                          <span className="rounded-full border border-bit-border bg-bit-bg/35 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                            {goalStatus === 'done' ? `Completed ${goal.version}` : `From ${goal.version}`}
                          </span>
                        </div>
                        <h2 className="mt-3 text-xl font-display font-bold text-bit-text md:text-2xl">{goal.title}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-7 text-bit-muted">{goal.summary}</p>
                      </div>
                    </div>
                    <div className="w-full shrink-0 lg:w-56">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                          Goal progress
                        </span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-accent tabular-nums">
                          {goalProgress}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-bit-bg/70">
                        <div className={`h-full rounded-full ${meta.barClassName}`} style={{ width: `${goalProgress}%` }} />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-bit-border bg-bit-bg/25 px-4 py-3 text-left transition-all hover:border-bit-accent/35 hover:bg-bit-panel/35"
                    aria-expanded={isExpanded}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-bit-text">
                        {isExpanded ? 'Hide sub-goals' : 'Show sub-goals'}
                      </span>
                      <span className="mt-1 block text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                        {goal.subGoals.length} progress checkpoints
                      </span>
                    </span>
                    <ChevronDown size={18} className={`shrink-0 text-bit-accent transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {goal.subGoals.map((subGoal) => (
                        <div key={subGoal.title} className="flex items-center gap-3 rounded-xl border border-bit-border bg-bit-bg/25 p-3">
                          <CircularProgress value={subGoal.progress} label={`${subGoal.title} progress`} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-5 text-bit-text">{subGoal.title}</p>
                            <p className="mt-1 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-bit-muted">
                              {subGoal.progress}% complete
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            </section>

            <section className="rounded-2xl border border-bit-border bg-bit-panel/25 p-5 md:p-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-bit-accent">Decision Principles</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {principles.map((principle) => (
                <div key={principle} className="rounded-xl border border-bit-border bg-bit-bg/25 p-4 text-sm leading-6 text-bit-muted">
                  {principle}
                </div>
              ))}
            </div>
            </section>
          </main>

          <aside className="overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/30 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)]">
            <div className="border-b border-bit-border/70 bg-bit-bg/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">Milestones</p>
                  <h2 className="mt-1 text-lg font-display font-bold text-bit-text">Release path</h2>
                </div>
                <span className="rounded-full border border-bit-border bg-bit-bg/45 px-2.5 py-1 text-[10px] font-mono font-bold text-bit-muted">
                  {milestoneGroups.length}
                </span>
              </div>
            </div>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4 pr-3 lg:max-h-[calc(100svh-14rem)]">
              {milestoneGroups.map((milestone) => {
                const isDone = milestone.doneCount === milestone.goals.length;
                const isFuture = milestone.version === 'Future';
                const statusLabel = isDone ? 'Completed' : isFuture ? 'Future' : 'In progress';
                return (
                  <div key={milestone.version} className={`relative overflow-hidden rounded-xl border p-3 transition-colors ${isDone ? 'border-emerald-400/20 bg-emerald-400/5' : isFuture ? 'border-violet-300/25 bg-violet-300/8' : 'border-bit-accent/25 bg-bit-accent/8'}`}>
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-bit-accent/60" />
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${isDone ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300' : isFuture ? 'border-violet-300/35 bg-violet-300/10 text-violet-200' : 'border-bit-accent/35 bg-bit-accent/10 text-bit-accent'}`}>
                        {isDone ? <CheckCircle2 size={15} /> : isFuture ? <Sparkles size={15} /> : <Clock3 size={15} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-bit-text">{milestone.version}</p>
                          <span className="text-[10px] font-mono font-bold text-bit-accent tabular-nums">{milestone.progress}%</span>
                        </div>
                        <p className="mt-0.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-bit-muted">
                          {statusLabel}
                        </p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bit-bg/70">
                          <div className="h-full rounded-full bg-bit-accent" style={{ width: `${milestone.progress}%` }} />
                        </div>
                        <p className="mt-2 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-bit-muted">
                          {milestone.doneCount}/{milestone.goals.length} complete
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {milestone.goals.slice(0, 4).map((goal) => (
                        <div key={goal.id} className="flex items-center justify-between gap-2 rounded-lg border border-bit-border/60 bg-bit-bg/25 px-2.5 py-2 text-xs">
                          <span className="line-clamp-1 font-medium text-bit-text/85">{goal.title}</span>
                          <span className="shrink-0 font-mono text-[10px] font-bold text-bit-accent">{getGoalProgress(goal.subGoals)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RoadmapPage;
