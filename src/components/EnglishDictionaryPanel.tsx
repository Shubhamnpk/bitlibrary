import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpenText, Loader2, Search, Volume2 } from 'lucide-react';
import { fetchEnglishDictionaryEntries, type EnglishDictionaryEntry } from '@/services/englishDictionaryService';

const SAMPLE_WORD = 'hello';
const QUICK_WORDS = ['hello', 'knowledge', 'river', 'library', 'curious'];

interface EnglishDictionaryPanelProps {
  className?: string;
  eyebrow?: string;
  heading?: string;
  description?: string;
  initialWord?: string;
  autoFocus?: boolean;
  hero?: boolean;
}

const EnglishDictionaryPanel: React.FC<EnglishDictionaryPanelProps> = ({
  className = '',
  eyebrow = 'English Definitions',
  heading = 'Look up an English word.',
  description = 'Uses dictionaryapi.dev for live definitions, phonetics, examples, and audio when available.',
  initialWord = SAMPLE_WORD,
  autoFocus = false,
  hero = false,
}) => {
  const [word, setWord] = useState(initialWord);
  const [entries, setEntries] = useState<EnglishDictionaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }

    return () => {
      audioRef.current?.pause();
    };
  }, [autoFocus]);

  const lookupWord = async (nextWord: string) => {
    const trimmed = nextWord.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      setEntries(await fetchEnglishDictionaryEntries(trimmed, controller.signal));
    } catch {
      setError('English definition lookup is unavailable right now.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = (event?: React.FormEvent) => {
    event?.preventDefault();
    void lookupWord(word);
  };

  const handleQuickWord = (nextWord: string) => {
    setWord(nextWord);
    void lookupWord(nextWord);
  };

  const playAudio = (audioUrl: string) => {
    audioRef.current?.pause();
    audioRef.current = new Audio(audioUrl);
    void audioRef.current.play();
  };

  return (
    <section className={`rounded-[2rem] border border-bit-border bg-bit-panel/30 p-5 shadow-sm md:p-7 ${className}`}>
      <div className={`flex flex-col gap-4 ${hero ? 'items-center text-center' : 'sm:flex-row sm:items-start sm:justify-between'}`}>
        <div className={`flex items-start gap-3 ${hero ? 'max-w-3xl flex-col items-center' : ''}`}>
          <div className={`flex shrink-0 items-center justify-center border border-bit-accent/15 bg-bit-accent/10 text-bit-accent ${hero ? 'h-12 w-12 rounded-2xl' : 'h-11 w-11 rounded-xl'}`}>
            <BookOpenText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">{eyebrow}</p>
            <h2 className={`mt-2 font-display font-bold text-bit-text ${hero ? 'text-4xl leading-tight md:text-6xl' : 'text-2xl'}`}>{heading}</h2>
            <p className={`mt-2 leading-7 text-bit-muted ${hero ? 'text-base md:text-lg' : 'text-sm'}`}>
              {description}
            </p>
          </div>
        </div>
        {!hero && (
          <a
            href="https://api.dictionaryapi.dev/api/v2/entries/en/hello"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-bg/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted transition-colors hover:border-bit-accent/35 hover:text-bit-accent"
          >
            API example
          </a>
        )}
      </div>

      <form onSubmit={handleLookup} className={`mx-auto flex flex-col gap-3 rounded-2xl border border-bit-border bg-bit-bg/50 p-3 shadow-sm sm:flex-row sm:items-center ${hero ? 'mt-8 max-w-3xl' : 'mt-5'}`}>
        <label htmlFor="english-dictionary-word" className="sr-only">English word</label>
        <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-bit-border bg-bit-panel/30 px-3 ${hero ? 'py-3' : 'py-2'}`}>
          <Search size={hero ? 18 : 16} className="shrink-0 text-bit-accent" />
          <input
            ref={inputRef}
            id="english-dictionary-word"
            type="search"
            value={word}
            onChange={(event) => setWord(event.target.value)}
            placeholder="Try hello, book, river..."
            className={`min-w-0 flex-1 bg-transparent text-bit-text outline-none placeholder:text-bit-muted/55 ${hero ? 'text-base' : 'text-sm'}`}
          />
        </div>
        <button
          type="submit"
          disabled={loading || word.trim().length === 0}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-bit-accent px-5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-white shadow-sm transition-all hover:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${hero ? 'h-12' : 'h-10'}`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Define
        </button>
      </form>

      <div className={`mt-3 flex flex-wrap gap-2 ${hero ? 'justify-center' : ''}`}>
        {QUICK_WORDS.map((quickWord) => (
          <button
            key={quickWord}
            type="button"
            onClick={() => handleQuickWord(quickWord)}
            className="rounded-full border border-bit-border bg-bit-bg/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-bit-muted transition-all hover:border-bit-accent/35 hover:text-bit-accent"
          >
            {quickWord}
          </button>
        ))}
      </div>

      <div className={`mx-auto mt-6 rounded-2xl border border-bit-border bg-bit-bg/30 p-4 ${hero ? 'max-w-4xl' : ''}`}>
        {error ? (
          <div className="flex gap-3 text-sm leading-7 text-red-400">
            <AlertCircle size={17} className="mt-1 shrink-0" />
            <span>{error}</span>
          </div>
        ) : loading ? (
          <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-bit-muted">
            <Loader2 size={18} className="animate-spin text-bit-accent" />
            Looking up definition...
          </div>
        ) : entries.length > 0 ? (
          <div className="space-y-5">
            {entries.map((entry, entryIndex) => (
              <article key={`${entry.word}-${entryIndex}`} className="rounded-xl border border-bit-border bg-bit-panel/35 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-display font-bold text-bit-text">{entry.word}</h3>
                    {entry.audio && (
                      <button
                        type="button"
                        onClick={() => playAudio(entry.audio as string)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-bit-border bg-bit-bg/35 text-bit-muted transition-colors hover:border-bit-accent/35 hover:text-bit-accent"
                        aria-label={`Play pronunciation for ${entry.word}`}
                        title="Play pronunciation"
                      >
                        <Volume2 size={15} />
                      </button>
                    )}
                  </div>
                  <div>
                    {entry.phonetic && (
                      <p className="mt-1 text-sm text-bit-muted">{entry.phonetic}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {entry.meanings.slice(0, 4).map((meaning) => (
                    <section key={meaning.partOfSpeech} className="border-t border-bit-border/70 pt-4">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-bit-accent">{meaning.partOfSpeech}</p>
                      <ol className="mt-3 space-y-3">
                        {meaning.definitions.map((definition, index) => (
                          <li key={`${definition.definition}-${index}`} className="text-sm leading-7 text-bit-muted">
                            <span className="mr-2 font-mono text-[10px] text-bit-accent">{index + 1}.</span>
                            <span className="text-bit-text">{definition.definition}</span>
                            {definition.example && (
                              <p className="mt-1 pl-6 text-xs italic leading-6 text-bit-muted">"{definition.example}"</p>
                            )}
                            {definition.synonyms.length > 0 && (
                              <p className="mt-2 pl-6 text-xs leading-6 text-bit-muted">
                                Synonyms: {definition.synonyms.slice(0, 6).join(', ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : hasSearched ? (
          <div className="flex min-h-32 flex-col justify-center rounded-xl border border-dashed border-bit-border px-4 py-8 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">No definition found</p>
            <p className="mt-2 text-sm leading-7 text-bit-muted">Try another English word.</p>
          </div>
        ) : (
          <div className="flex min-h-32 flex-col justify-center rounded-xl border border-dashed border-bit-border px-4 py-8 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">Try it here</p>
            <p className="mt-2 text-sm leading-7 text-bit-muted">Search a word to get definitions from the public dictionary API.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default EnglishDictionaryPanel;
