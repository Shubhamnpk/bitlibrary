import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { downloadResource, type DownloadOption } from '@/lib/downloads';

interface DownloadSplitButtonProps {
  options: DownloadOption[];
  variant?: 'icon' | 'button';
}

const formatLabel = (format: DownloadOption['format']) => (
  format === 'unknown' ? 'FILE' : format.toUpperCase()
);

const DownloadSplitButton: React.FC<DownloadSplitButtonProps> = ({ options, variant = 'button' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const primaryOption = options[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  if (!primaryOption) return null;
  const hasMultipleOptions = options.length > 1;

  const handleDownload = (option: DownloadOption) => {
    downloadResource(option);
    setOpen(false);
  };

  if (variant === 'icon') {
    return (
      <div ref={rootRef} className="relative flex items-center sm:border-r sm:border-bit-border">
        <button
          type="button"
          onClick={() => handleDownload(primaryOption)}
          className="rounded-l-lg p-2.5 text-bit-accent transition-all hover:bg-bit-panel hover:text-bit-text sm:p-3 group"
          title={`Download ${primaryOption.label}`}
          aria-label={`Download ${primaryOption.label}`}
        >
          <Download size={17} className="transition-transform group-hover:translate-y-0.5 sm:size-[18px]" />
        </button>
        {hasMultipleOptions && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-r-lg px-1.5 py-2.5 text-bit-muted transition-all hover:bg-bit-panel hover:text-bit-accent sm:py-3"
            title="More download options"
            aria-label="More download options"
            aria-expanded={open}
          >
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        {hasMultipleOptions && open && (
          <div className="absolute right-0 top-full z-[10200] mt-2 w-64 overflow-hidden rounded-xl border border-bit-border bg-bit-bg shadow-2xl shadow-black/30">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleDownload(option)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs text-bit-muted transition-colors hover:bg-bit-panel hover:text-bit-text"
              >
                <span className="min-w-0 truncate">{option.label}</span>
                <span className="shrink-0 rounded-full border border-bit-border px-2 py-0.5 font-mono text-[9px] text-bit-accent">{formatLabel(option.format)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex min-w-0">
      <button
        type="button"
        onClick={() => handleDownload(primaryOption)}
        className={`flex min-w-0 items-center justify-center gap-2 border border-bit-accent/30 bg-bit-panel/50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase text-bit-accent shadow-sm transition-all hover:border-bit-accent hover:bg-bit-accent hover:text-white active:scale-95 sm:px-5 group/dl ${hasMultipleOptions ? 'rounded-l-lg border-r-0' : 'rounded-lg'}`}
      >
        <Download size={16} className="shrink-0 transition-transform group-hover/dl:translate-y-0.5" />
        Download
      </button>
      {hasMultipleOptions && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center justify-center rounded-r-lg border border-bit-accent/30 bg-bit-panel/50 px-2.5 text-bit-accent shadow-sm transition-all hover:border-bit-accent hover:bg-bit-accent hover:text-white"
          title="More download options"
          aria-label="More download options"
          aria-expanded={open}
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {hasMultipleOptions && open && (
        <div className="absolute right-0 top-full z-[10200] mt-2 w-72 overflow-hidden rounded-xl border border-bit-border bg-bit-bg shadow-2xl shadow-black/30">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleDownload(option)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs text-bit-muted transition-colors hover:bg-bit-panel hover:text-bit-text"
            >
              <span className="min-w-0 truncate">{option.label}</span>
              <span className="shrink-0 rounded-full border border-bit-border px-2 py-0.5 font-mono text-[9px] text-bit-accent">{formatLabel(option.format)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadSplitButton;
