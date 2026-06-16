import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile, UserSettings } from '@/types/index';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Bookmark, ChevronDown, Clock, Database, HardDrive, Moon, Search, Settings, ShieldCheck, Sun, Trash2, User, User2 } from 'lucide-react';
import { clearLocalUserData, setThemeMode, updateDisplayName } from '@/lib/local-user';
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

const SettingsPage: React.FC<SettingsPageProps> = ({ profile, settings, recentSearches, onBack }) => {
  const [draftName, setDraftName] = useState(profile.displayName);
  const [showProfile, setShowProfile] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showSearches, setShowSearches] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [storageReport, setStorageReport] = useState<StorageEntryReport[]>(() => getStorageReport());

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

  const handleSaveProfile = () => { updateDisplayName(draftName); setShowProfile(false); };
  const handleClearStaleCaches = () => { clearStaleCaches(); refreshStorageReport(); };
  const handleClearRecoverableCaches = () => { clearRecoverableCaches(); refreshStorageReport(); };
  const handleClearReaderProgress = () => { clearStorageCategory('reader'); refreshStorageReport(); };

  const sections = [
    {
      key: 'profile', title: 'Profile name', summary: profile.displayName || 'Reader', icon: User2,
      open: showProfile, setOpen: setShowProfile,
      content: (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-bit-text">Display name: <span className="text-bit-accent font-semibold">{profile.displayName || 'Reader'}</span></label>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Reader"
            className="w-full rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-3 text-sm text-bit-text transition-all focus:border-bit-accent/50 focus:outline-none focus:ring-1 focus:ring-bit-accent/20" />
          <button onClick={handleSaveProfile}
            className="w-full rounded-xl bg-bit-accent py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-bit-accent/20 transition-all hover:scale-[0.98]">Save name</button>
        </div>
      ),
    },
    {
      key: 'appearance', title: 'Appearance', summary: settings.theme === 'dark' ? 'Dark theme' : 'Light theme', icon: Settings,
      open: showAppearance, setOpen: setShowAppearance,
      content: (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setThemeMode('dark')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}>
            <Moon size={18} className="mb-3" /><p className="font-display text-sm font-bold">Dark</p>
          </button>
          <button onClick={() => setThemeMode('light')}
            className={`rounded-xl border p-4 text-left transition-all ${settings.theme === 'light' ? 'border-bit-accent bg-bit-accent text-white shadow-lg shadow-bit-accent/20' : 'border-bit-border bg-bit-panel/50 text-bit-muted hover:border-bit-accent/30'}`}>
            <Sun size={18} className="mb-3" /><p className="font-display text-sm font-bold">Light</p>
          </button>
        </div>
      ),
    },
    {
      key: 'searches', title: 'Recent searches', summary: `${recentSearches.length} saved`, icon: Search,
      open: showSearches, setOpen: setShowSearches,
      content: recentSearches.length > 0 ? (
        <div className="flex flex-wrap gap-2">{recentSearches.map((q) => (
          <span key={q} className="rounded-xl border border-bit-border bg-bit-panel/50 px-3 py-2 text-xs text-bit-text shadow-sm">{q}</span>
        ))}</div>
      ) : (<p className="text-sm leading-7 text-bit-muted">Your recent searches will appear here.</p>),
    },
    {
      key: 'storage', title: 'Cache and storage', summary: `${formatStorageBytes(storageSummary.totalBytes)} on this device`, icon: HardDrive,
      open: showStorage, setOpen: setShowStorage,
      content: (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Total</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{formatStorageBytes(storageSummary.totalBytes)}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Entries</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{storageSummary.entryCount}</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-bg/35 p-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Stale</p>
              <p className="mt-1 text-lg font-bold text-bit-text">{storageSummary.staleCount}</p>
            </div>
          </div>
          <div className="space-y-2">{storageRows.map(([key, label, stats]) => (
            <div key={key} className="rounded-xl border border-bit-border bg-bit-panel/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {key === 'account' ? <ShieldCheck size={15} className="shrink-0 text-bit-accent" /> : <Database size={15} className="shrink-0 text-bit-muted" />}
                  <span className="truncate text-sm font-semibold text-bit-text">{label}</span>
                </div>
                <span className="shrink-0 text-xs font-mono text-bit-muted">{formatStorageBytes(stats.bytes)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-bit-muted">
                <span>{stats.count} entries</span><span>{stats.staleCount} stale</span>
              </div>
            </div>
          ))}</div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={handleClearStaleCaches} disabled={storageSummary.staleCount === 0}
              className="flex items-center gap-4 rounded-xl border border-bit-border bg-bit-panel/50 p-4 text-left transition-all hover:border-bit-accent/30 hover:bg-bit-panel/70 disabled:cursor-not-allowed disabled:opacity-40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-bit-border bg-bit-bg/50 text-bit-muted">
                <Clock size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-display font-bold text-bit-text">Clear stale caches</p>
                <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Remove outdated cache entries that are no longer needed.</p>
              </div>
              <span className="shrink-0 text-xs font-mono text-bit-muted">{storageSummary.staleCount} stale</span>
            </button>
            <button type="button" onClick={handleClearRecoverableCaches}
              className="flex items-center gap-4 rounded-xl border border-bit-accent/25 bg-bit-accent/[0.04] p-4 text-left transition-all hover:bg-bit-accent/[0.08]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                <Database size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-display font-bold text-bit-accent">Clear all caches</p>
                <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Remove all recoverable cached data (API and page caches).</p>
              </div>
              <span className="shrink-0 text-xs font-mono text-bit-muted">{formatStorageBytes(storageSummary.totalBytes)}</span>
            </button>
            <button type="button" onClick={handleClearReaderProgress}
              className="flex items-center gap-4 rounded-xl border border-bit-border bg-bit-panel/50 p-4 text-left transition-all hover:border-bit-accent/30 hover:bg-bit-panel/70">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-bit-border bg-bit-bg/50 text-bit-muted">
                <BookOpenText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-display font-bold text-bit-text">Clear reading progress</p>
                <p className="mt-0.5 text-xs leading-relaxed text-bit-muted">Reset saved page positions and reading history.</p>
              </div>
            </button>
          </div>
          <p className="text-xs leading-6 text-bit-muted">Saved books, audiobooks, profile name, and theme are protected from cache cleanup.</p>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in pb-24">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <Link to="/mylibrary"
              className="flex items-center gap-2 rounded-xl border border-bit-border bg-bit-panel/50 px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-widest text-bit-muted transition-all hover:border-bit-accent/30 hover:text-bit-accent">
              <ArrowLeft size={14} /> My Library
            </Link>
            </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
              <User size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-bit-text">Profile</h1>
              <p className="text-sm leading-6 text-bit-muted">Manage your profile, appearance, and local data.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.key} className="rounded-xl border border-bit-border bg-bit-panel/50 p-5 shadow-sm">
                <button type="button" onClick={() => section.setOpen(!section.open)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-bit-accent/20 bg-bit-accent/10 text-bit-accent">
                      <Icon size={17} />
                    </span>
                    <span>
                      <span className="block text-sm font-display font-bold text-bit-text">{section.title}</span>
                      <span className="mt-0.5 block text-xs text-bit-muted">{section.summary}</span>
                    </span>
                  </span>
                  <ChevronDown size={15} className={`shrink-0 text-bit-muted transition-transform ${section.open ? 'rotate-180' : ''}`} />
                </button>
                {section.open && <div className="mt-4 border-t border-bit-border pt-4">{section.content}</div>}
              </section>
            );
          })}

          <section className="rounded-xl border border-red-500/10 bg-red-500/5 p-5 shadow-sm">
            <button type="button" onClick={() => setShowReset((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left">
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500">
                  <Trash2 size={17} />
                </span>
                <span>
                  <span className="block text-sm font-display font-bold text-red-500">Reset local data</span>
                  <span className="mt-0.5 block text-xs text-red-500/70">Only needed when you want to clear this device.</span>
                </span>
              </span>
              <ChevronDown size={15} className={`shrink-0 text-red-500/70 transition-transform ${showReset ? 'rotate-180' : ''}`} />
            </button>
            {showReset && (
              <div className="mt-4 border-t border-red-500/10 pt-4">
                <p className="text-xs leading-6 text-red-500/75">This removes your saved books, favorite audiobooks, recent searches, and local preferences from this browser.</p>
                <button onClick={clearLocalUserData}
                  className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-500 transition-all hover:bg-red-500 hover:text-white">
                  <Trash2 size={14} className="inline-block -mt-0.5 mr-1.5" />
                  Reset everything
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
