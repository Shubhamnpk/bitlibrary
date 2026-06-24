import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile, UserSettings } from '@/types/index';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Bookmark, Clock, Database, HardDrive, LogOut, Moon, Palette, Search, Settings, ShieldCheck, Sun, Trash2, User, User2 } from 'lucide-react';
import { clearLocalUserData, readLocalUserState, setThemeMode, updateDisplayName } from '@/lib/local-user';
import {
  clearRecoverableCaches,
  clearStaleCaches,
  clearStorageCategory,
  formatStorageBytes,
  getStorageReport,
  getStorageReportEventName,
  getStorageSummary,
  type StorageEntryReport,
} from '@/lib/storage-manager';

interface SettingsPageProps {
  profile: UserProfile;
  settings: UserSettings;
  recentSearches: string[];
  onBack?: () => void;
}

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'searches', label: 'Searches', icon: Search },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'reset', label: 'Reset', icon: Trash2 },
] as const;

type TabId = typeof tabs[number]['id'];

const SettingsPage: React.FC<SettingsPageProps> = ({ profile, settings, recentSearches, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [openSections, setOpenSections] = useState<Set<TabId>>(new Set(['profile']));
  const toggleSection = (id: TabId) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [draftName, setDraftName] = useState(profile.displayName);
  const [storageReport, setStorageReport] = useState<StorageEntryReport[]>(() => getStorageReport());
  const localUser = readLocalUserState();

  const storageSummary = useMemo(() => getStorageSummary(storageReport), [storageReport]);
  const storageRows = useMemo(() => [
    ['account', 'Account', storageSummary.categories.account],
    ['reader', 'Reader', storageSummary.categories.reader],
    ['api-cache', 'API cache', storageSummary.categories['api-cache']],
    ['page-cache', 'Page cache', storageSummary.categories['page-cache']],
    ['unknown', 'Unmanaged', storageSummary.categories.unknown],
  ] as const, [storageSummary]);

  const refreshStorageReport = () => setStorageReport(getStorageReport());

  useEffect(() => {
    refreshStorageReport();
    const eventName = getStorageReportEventName();
    window.addEventListener(eventName, refreshStorageReport);
    window.addEventListener('storage', refreshStorageReport);
    return () => {
      window.removeEventListener(eventName, refreshStorageReport);
      window.removeEventListener('storage', refreshStorageReport);
    };
  }, []);

  const handleSaveProfile = () => { updateDisplayName(draftName); setDraftName(draftName); };
  const handleClearStaleCaches = () => { clearStaleCaches(); refreshStorageReport(); };
  const handleClearRecoverableCaches = () => { clearRecoverableCaches(); refreshStorageReport(); };
  const handleClearReaderProgress = () => { clearStorageCategory('reader'); refreshStorageReport(); };

  const savedBookCount = localUser?.savedBooks?.length || 0;
  const savedAudiobookCount = localUser?.savedAudiobooks?.length || 0;

  const tabContent: Record<TabId, React.ReactNode> = {
    profile: (
      <div className="space-y-4">
        <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-5">
          <label className="mb-2 block text-xs font-mono font-bold uppercase tracking-widest text-bit-muted">Display name</label>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
              <User2 size={20} />
            </div>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Reader"
              className="w-full rounded-xl border border-bit-border bg-bit-bg/50 px-4 py-2.5 text-sm text-bit-text transition-all placeholder:text-bit-muted/50 focus:border-bit-accent/50 focus:outline-none focus:ring-1 focus:ring-bit-accent/20" />
          </div>
          <button onClick={handleSaveProfile}
            className="mt-3 w-full rounded-xl bg-bit-accent py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-[0.98] active:scale-[0.97]">Save</button>
        </div>

        <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-5">
          <label className="mb-2 block text-xs font-mono font-bold uppercase tracking-widest text-bit-muted">Avatar initials</label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-bit-accent to-bit-accent/70 text-xl font-bold text-white shadow-lg shadow-bit-accent/20">
              {(draftName || 'R')[0].toUpperCase()}
            </div>
            <p className="text-xs leading-relaxed text-bit-muted">Your avatar appears as initials in the top navigation bar.</p>
          </div>
        </div>

        {savedBookCount > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-4">
              <BookOpenText size={20} className="text-bit-accent" />
              <p className="mt-3 text-2xl font-bold text-bit-text tabular-nums">{savedBookCount}</p>
              <p className="mt-0.5 text-xs text-bit-muted">Saved books</p>
            </div>
            <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-4">
              <Bookmark size={20} className="text-bit-accent" />
              <p className="mt-3 text-2xl font-bold text-bit-text tabular-nums">{savedAudiobookCount}</p>
              <p className="mt-0.5 text-xs text-bit-muted">Saved audiobooks</p>
            </div>
          </div>
        )}
      </div>
    ),

    appearance: (
      <div className="space-y-5">
        <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-5">
          <label className="mb-3 block text-xs font-mono font-bold uppercase tracking-widest text-bit-muted">Theme</label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setThemeMode('dark')}
              className={`group relative overflow-hidden rounded-xl border p-5 text-left transition-all ${settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent/10 ring-1 ring-bit-accent/25' : 'border-bit-border bg-bit-bg/40 hover:border-bit-accent/30'}`}>
              <div className={`absolute inset-0 bg-gradient-to-br from-zinc-900 to-black transition-opacity ${settings.theme === 'dark' ? 'opacity-100' : 'opacity-0'}`} />
              <Moon size={22} className={`relative mb-3 ${settings.theme === 'dark' ? 'text-bit-accent' : 'text-bit-muted'}`} />
              <p className={`relative text-sm font-display font-bold ${settings.theme === 'dark' ? 'text-white' : 'text-bit-text'}`}>Dark</p>
              <p className={`relative mt-1 hidden text-xs leading-5 md:block ${settings.theme === 'dark' ? 'text-zinc-400' : 'text-bit-muted'}`}>Easy on the eyes in low light.</p>
            </button>
            <button onClick={() => setThemeMode('light')}
              className={`group relative overflow-hidden rounded-xl border p-5 text-left transition-all ${settings.theme === 'light' ? 'border-bit-accent bg-bit-accent/10 ring-1 ring-bit-accent/25' : 'border-bit-border bg-bit-bg/40 hover:border-bit-accent/30'}`}>
              <div className={`absolute inset-0 bg-gradient-to-br from-amber-50 to-white transition-opacity ${settings.theme === 'light' ? 'opacity-100' : 'opacity-0'}`} />
              <Sun size={22} className={`relative mb-3 ${settings.theme === 'light' ? 'text-bit-accent' : 'text-bit-muted'}`} />
              <p className={`relative text-sm font-display font-bold ${settings.theme === 'light' ? 'text-zinc-900' : 'text-bit-text'}`}>Light</p>
              <p className={`relative mt-1 hidden text-xs leading-5 md:block ${settings.theme === 'light' ? 'text-zinc-500' : 'text-bit-muted'}`}>Bright and crisp for daytime.</p>
            </button>
          </div>
        </div>
      </div>
    ),

    searches: (
      <div className="rounded-2xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-5">
        <label className="mb-3 block text-xs font-mono font-bold uppercase tracking-widest text-bit-muted">Recent searches</label>
        {recentSearches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <span key={q} className="rounded-xl border border-bit-border bg-bit-bg/50 px-3.5 py-2 text-xs text-bit-text shadow-sm transition-all hover:border-bit-accent/30 hover:bg-bit-accent/5">
                {q}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-bit-border bg-bit-bg/30 py-10">
            <Search size={24} className="text-bit-muted/40" />
            <p className="text-sm text-bit-muted">No recent searches yet.</p>
          </div>
        )}
      </div>
    ),

    storage: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-3.5">
            <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Total</p>
            <p className="mt-1 text-lg font-bold text-bit-text tabular-nums">{formatStorageBytes(storageSummary.totalBytes)}</p>
          </div>
          <div className="rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-3.5">
            <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Entries</p>
            <p className="mt-1 text-lg font-bold text-bit-text tabular-nums">{storageSummary.entryCount}</p>
          </div>
          <div className="rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/60 to-bit-bg/40 p-3.5">
            <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Stale</p>
            <p className="mt-1 text-lg font-bold text-bit-text tabular-nums">{storageSummary.staleCount}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {storageRows.map(([key, label, stats]) => (
            <div key={key} className="group rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/40 to-bit-bg/30 p-3.5 transition-all hover:border-bit-accent/20 hover:bg-bit-panel/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {key === 'account' ? <ShieldCheck size={15} className="shrink-0 text-bit-accent" /> : <Database size={15} className="shrink-0 text-bit-muted" />}
                  <span className="truncate text-sm font-semibold text-bit-text">{label}</span>
                </div>
                <span className="shrink-0 text-xs font-mono text-bit-muted">{formatStorageBytes(stats.bytes)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-bit-muted/60">
                <span>{stats.count} entries</span>
                {stats.staleCount > 0 && <span className="text-bit-accent">{stats.staleCount} stale</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <button type="button" onClick={handleClearStaleCaches} disabled={storageSummary.staleCount === 0}
            className="flex w-full items-center gap-3.5 rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/50 to-bit-bg/30 p-3.5 text-left transition-all hover:border-bit-accent/30 hover:bg-bit-panel/70 disabled:cursor-not-allowed disabled:opacity-40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bit-border bg-bit-bg/50 text-bit-muted">
              <Clock size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bit-text">Clear stale caches</p>
              <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Remove outdated cache entries no longer needed.</p>
            </div>
            <span className="shrink-0 rounded-full border border-bit-accent/20 bg-bit-accent/10 px-2.5 py-1 text-[10px] font-mono font-bold text-bit-accent">{storageSummary.staleCount} stale</span>
          </button>
          <button type="button" onClick={handleClearRecoverableCaches}
            className="flex w-full items-center gap-3.5 rounded-xl border border-bit-accent/20 bg-gradient-to-br from-bit-accent/[0.04] to-bit-bg/30 p-3.5 text-left transition-all hover:from-bit-accent/[0.08]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
              <Database size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bit-accent">Clear all caches</p>
              <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Remove all recoverable cached data.</p>
            </div>
            <span className="shrink-0 text-xs font-mono text-bit-muted">{formatStorageBytes(storageSummary.totalBytes)}</span>
          </button>
          <button type="button" onClick={handleClearReaderProgress}
            className="flex w-full items-center gap-3.5 rounded-xl border border-bit-border bg-gradient-to-br from-bit-panel/50 to-bit-bg/30 p-3.5 text-left transition-all hover:border-bit-accent/30 hover:bg-bit-panel/70">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bit-border bg-bit-bg/50 text-bit-muted">
              <BookOpenText size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-bit-text">Clear reading progress</p>
              <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Reset saved page positions and reading history.</p>
            </div>
          </button>
        </div>

        <p className="text-xs leading-relaxed text-bit-muted/60">Saved books, audiobooks, profile name, and theme are protected from cache cleanup.</p>
      </div>
    ),

    reset: (
      <div className="rounded-2xl border border-red-500/15 bg-gradient-to-br from-red-500/[0.04] to-bit-bg/30 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500">
            <LogOut size={20} />
          </div>
          <div>
            <p className="text-sm font-display font-bold text-red-500">Reset local data</p>
            <p className="mt-0.5 text-xs leading-relaxed text-red-500/70">This removes your saved books, audiobooks, recent searches, and local preferences from this browser.</p>
          </div>
        </div>
        <button onClick={clearLocalUserData}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white active:scale-[0.98]">
          <Trash2 size={14} />
          Reset everything
        </button>
      </div>
    ),
  };

  return (
    <div className="animate-fade-in pb-32 pt-6 md:pt-10 md:pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 hidden md:flex md:items-center md:justify-between">
          <Link to="/mylibrary"
            className="flex items-center gap-2 rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
            <ArrowLeft size={14} /> Library
          </Link>
        </div>

        <div className="mb-8 flex flex-col items-center gap-3 md:mb-6 md:flex-row md:items-center md:gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-bit-accent to-bit-accent/70 text-2xl font-bold text-white shadow-lg shadow-bit-accent/20 md:h-14 md:w-14 md:rounded-2xl md:text-xl">
            {(profile.displayName || 'R')[0].toUpperCase()}
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-xl font-display font-bold text-bit-text md:text-2xl">{profile.displayName || 'Reader'}</h1>
            <p className="mt-0.5 hidden text-sm text-bit-muted md:block">Manage your profile, appearance, and local data.</p>
          </div>
        </div>

        {/* Mobile: collapsible section cards */}
        <div className="space-y-2 lg:hidden">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isOpen = openSections.has(tab.id);
            const isDanger = tab.id === 'reset';
            return (
              <div key={tab.id} className="overflow-hidden rounded-2xl border border-bit-border bg-bit-panel/30 shadow-sm">
                <button type="button" onClick={() => toggleSection(tab.id)}
                  className={`flex w-full items-center gap-3.5 px-5 py-4 text-left transition-all ${
                    isOpen
                      ? isDanger ? 'border-b border-red-500/15' : 'border-b border-bit-border/60'
                      : ''
                  }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isDanger ? 'bg-red-500/10 text-red-500' : 'bg-bit-accent/10 text-bit-accent'
                  }`}>
                    <TabIcon size={18} />
                  </div>
                  <span className={`flex-1 text-sm font-semibold ${isDanger ? 'text-red-500' : 'text-bit-text'}`}>{tab.label}</span>
                  <svg className={`h-4 w-4 text-bit-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {isOpen && (
                  <div className="animate-fade-in px-5 py-5">
                    {tabContent[tab.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop: sidebar tabs */}
        <div className="hidden lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
          <div>
            <nav className="flex flex-col gap-1 rounded-2xl border border-bit-border bg-bit-panel/40 p-1.5">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                const isDanger = tab.id === 'reset';
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? isDanger
                          ? 'bg-red-500/15 text-red-500 shadow-sm'
                          : 'bg-bit-accent text-white shadow-sm shadow-bit-accent/20'
                        : isDanger
                          ? 'text-red-500/70 hover:bg-red-500/10 hover:text-red-500'
                          : 'text-bit-muted hover:bg-bit-panel/60 hover:text-bit-text'
                    }`}>
                    <TabIcon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="min-h-[20rem]">
            <div className="animate-fade-in">
              {tabContent[activeTab]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
