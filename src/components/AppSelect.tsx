import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  label?: string;
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  selectClassName?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

const AppSelect: React.FC<AppSelectProps> = ({
  label,
  value,
  options,
  onChange,
  icon,
  className = '',
  selectClassName = '',
  size = 'md',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const heightClass = size === 'sm' ? 'h-10' : 'h-11';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel || label}
        className={`relative inline-flex ${heightClass} w-full min-w-0 items-center gap-2 rounded-lg border px-3 text-bit-muted transition-all focus-visible:border-bit-accent/50 focus-visible:outline-none ${
          open
            ? 'border-bit-accent/50 bg-bit-panel/40'
            : 'border-bit-border bg-bit-panel/25 hover:border-bit-border/70'
        } ${selectClassName}`}
      >
        {icon && <span className="shrink-0 text-bit-accent">{icon}</span>}
        {label && (
          <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
            {label}
          </span>
        )}
        <span className="min-w-0 flex-1 text-left text-xs font-semibold text-bit-text">
          {selectedOption?.label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-bit-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[10200] mt-1.5 overflow-hidden rounded-xl border border-bit-border bg-bit-panel/95 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors ${
                option.value === value
                  ? 'bg-bit-accent/10 text-bit-accent'
                  : 'text-bit-muted hover:bg-bit-panel hover:text-bit-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppSelect;
