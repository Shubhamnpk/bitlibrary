import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, SpellCheck } from 'lucide-react';
import type { NepaliSpellcheckResult } from '@/services/nepaliSpellcheckService';

const SAMPLE_TEXT = 'नेपाल सुन्दर देस हो';

const NepaliSpellcheckPanel: React.FC = () => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [result, setResult] = useState<NepaliSpellcheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { checkNepaliSpelling } = await import('@/services/nepaliSpellcheckService');
      setResult(await checkNepaliSpelling(trimmed));
    } catch {
      setError('Nepali spellcheck could not be loaded right now.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-[2rem] border border-bit-border bg-bit-panel/30 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bit-accent/15 bg-bit-accent/10 text-bit-accent">
            <SpellCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-bit-accent">Nepali Spellcheck</p>
            <h2 className="mt-2 text-2xl font-display font-bold text-bit-text">Check Nepali text offline.</h2>
            <p className="mt-2 text-sm leading-7 text-bit-muted">
              Uses the installed dictionary-ne Hunspell data. It checks spelling and suggestions, not word definitions yet.
            </p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-bit-border bg-bit-bg/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted">
          <Sparkles size={13} className="text-bit-accent" />
          On demand
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <label htmlFor="nepali-spellcheck-text" className="sr-only">Nepali text to check</label>
          <textarea
            id="nepali-spellcheck-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            className="w-full resize-none rounded-2xl border border-bit-border bg-bit-bg/55 p-4 text-base leading-8 text-bit-text outline-none transition-colors placeholder:text-bit-muted/50 focus:border-bit-accent/45"
            placeholder="नेपाली पाठ यहाँ लेख्नुहोस्..."
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCheck}
              disabled={loading || text.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-bit-accent px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-white shadow-sm transition-all hover:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <SpellCheck size={14} />}
              Check text
            </button>
            <button
              type="button"
              onClick={() => {
                setText(SAMPLE_TEXT);
                setResult(null);
                setError('');
              }}
              className="rounded-xl border border-bit-border bg-bit-panel/35 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-bit-muted transition-all hover:border-bit-accent/35 hover:text-bit-accent"
            >
              Sample
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-bit-border bg-bit-bg/30 p-4">
          {error ? (
            <div className="flex gap-3 text-sm leading-7 text-red-400">
              <AlertCircle size={17} className="mt-1 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !result ? (
            <div className="flex h-full min-h-40 flex-col justify-center rounded-xl border border-dashed border-bit-border px-4 py-8 text-center">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-muted">Ready</p>
              <p className="mt-2 text-sm leading-7 text-bit-muted">Run a check to see misspelled Nepali words and suggestions.</p>
            </div>
          ) : result.issues.length === 0 ? (
            <div className="flex h-full min-h-40 flex-col justify-center rounded-xl border border-bit-accent/20 bg-bit-accent/8 px-4 py-8 text-center">
              <CheckCircle2 size={24} className="mx-auto text-bit-accent" />
              <p className="mt-3 text-lg font-display font-bold text-bit-text">Looks good</p>
              <p className="mt-2 text-sm leading-7 text-bit-muted">{result.checkedWords} Nepali words checked.</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-bit-accent">Issues</p>
                  <p className="mt-1 text-sm text-bit-muted">{result.issues.length} possible spelling issue{result.issues.length === 1 ? '' : 's'}</p>
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-bit-muted">{result.checkedWords} words</p>
              </div>
              <div className="space-y-3">
                {result.issues.map((issue) => (
                  <article key={issue.word} className="rounded-xl border border-bit-border bg-bit-panel/35 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-display font-bold text-bit-text">{issue.word}</p>
                      {issue.count > 1 && (
                        <span className="rounded-full border border-bit-border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.16em] text-bit-muted">
                          x{issue.count}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {issue.suggestions.length > 0 ? issue.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setText((current) => current.replaceAll(issue.word, suggestion))}
                          className="rounded-full border border-bit-accent/20 bg-bit-accent/10 px-3 py-1.5 text-xs text-bit-accent transition-all hover:bg-bit-accent hover:text-white"
                        >
                          {suggestion}
                        </button>
                      )) : (
                        <span className="text-xs leading-6 text-bit-muted">No suggestions found.</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NepaliSpellcheckPanel;
