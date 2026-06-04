import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Headphones, Moon, Sun, User, X } from 'lucide-react';
import type { LocalUserState } from '@/types/index';
import { setThemeMode, updateDisplayName } from '@/lib/local-user';

interface MobileProfileModalProps {
  open: boolean;
  onClose: () => void;
  localUserState: LocalUserState;
}

const MobileProfileModal: React.FC<MobileProfileModalProps> = ({ open, onClose, localUserState }) => {
  const [draftName, setDraftName] = useState(localUserState.profile.displayName);
  const displayName = localUserState.profile.displayName || 'Reader';
  const initials = useMemo(() => (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'R'
  ), [displayName]);

  useEffect(() => {
    if (open) setDraftName(localUserState.profile.displayName);
  }, [localUserState.profile.displayName, open]);

  if (!open) return null;

  const handleSave = () => {
    updateDisplayName(draftName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] md:hidden" role="dialog" aria-modal="true" aria-label="Profile settings">
      <button
        type="button"
        aria-label="Close profile modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <section className="absolute inset-x-3 bottom-3 overflow-hidden rounded-2xl border border-bit-border bg-bit-bg shadow-2xl shadow-black/40">
        <div className="border-b border-bit-border bg-bit-panel/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-bit-accent/30 bg-bit-accent/10 text-sm font-bold text-bit-accent">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-display font-bold text-bit-text">{displayName}</p>
                <p className="mt-1 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted">Local profile</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-border bg-bit-bg text-bit-muted"
              aria-label="Close profile"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-3 text-center">
              <Bookmark size={16} className="mx-auto mb-1 text-bit-accent" />
              <p className="text-lg font-bold text-bit-text">{localUserState.savedBooks.length}</p>
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Books</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-3 text-center">
              <Headphones size={16} className="mx-auto mb-1 text-bit-accent" />
              <p className="text-lg font-bold text-bit-text">{localUserState.savedAudiobooks.length}</p>
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Audio</p>
            </div>
            <div className="rounded-xl border border-bit-border bg-bit-panel/30 p-3 text-center">
              <User size={16} className="mx-auto mb-1 text-bit-accent" />
              <p className="text-lg font-bold text-bit-text">{localUserState.recentlyViewed.length}</p>
              <p className="text-[9px] font-mono uppercase tracking-widest text-bit-muted">Recent</p>
            </div>
          </div>

          <div className="rounded-xl border border-bit-border bg-bit-panel/25 p-3">
            <label className="mb-2 block text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-accent">
              Display name
            </label>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Reader"
              className="w-full rounded-lg border border-bit-border bg-bit-bg px-3 py-2.5 text-sm text-bit-text focus:border-bit-accent/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSave}
              className="mt-3 h-10 w-full rounded-lg bg-bit-accent text-xs font-bold uppercase tracking-widest text-white"
            >
              Save profile
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`rounded-xl border p-3 text-left ${localUserState.settings.theme === 'dark' ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/30 text-bit-muted'}`}
            >
              <Moon size={17} className="mb-2" />
              <span className="text-sm font-semibold">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`rounded-xl border p-3 text-left ${localUserState.settings.theme === 'light' ? 'border-bit-accent bg-bit-accent text-white' : 'border-bit-border bg-bit-panel/30 text-bit-muted'}`}
            >
              <Sun size={17} className="mb-2" />
              <span className="text-sm font-semibold">Light</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MobileProfileModal;
