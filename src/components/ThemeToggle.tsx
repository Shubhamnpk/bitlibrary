import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useLocalUserState } from '@/lib/local-user';

export const ThemeToggle: React.FC = () => {
  const { state, setThemeMode } = useLocalUserState();
  const isLight = state.settings.theme === 'light';

  return (
    <button
      onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
      className="p-2 rounded-full border border-bit-border hover:border-bit-accent/50 hover:bg-bit-panel/50 transition-all text-bit-muted hover:text-bit-accent group"
      aria-label="Toggle theme"
    >
      {isLight ? (
        <Sun size={18} className="transition-transform group-hover:rotate-45" />
      ) : (
        <Moon size={18} className="transition-transform group-hover:-rotate-12" />
      )}
    </button>
  );
};
