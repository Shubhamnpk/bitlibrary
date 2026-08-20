import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface AppSelectOption {
  value: string;
  label: string;
  meta?: string;
  searchText?: string;
}

interface AppSelectProps {
  label?: string;
  value: string;
  options: AppSelectOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  selectClassName?: string;
  menuClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  ariaLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

interface MenuPosition {
  placement: 'bottom' | 'top';
  maxHeight: number;
  anchorRight: boolean;
}

const ROW_HEIGHT = 40;
const OVERSCAN = 6;

const AppSelect: React.FC<AppSelectProps> = ({
  label,
  value,
  options,
  onChange,
  icon,
  className = '',
  selectClassName = '',
  menuClassName = '',
  size = 'md',
  ariaLabel,
  searchable = false,
  searchPlaceholder = 'Search…',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeIndexRef = useRef(-1);
  const keyboardNavRef = useRef(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const updateActiveIndex = useCallback((next: number) => {
    activeIndexRef.current = next;
    setActiveIndex(next);
  }, []);

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.meta || ''} ${option.searchText || ''}`.toLowerCase();
      return query.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [options, searchQuery]);

  const selectedIndex = useMemo(
    () => Math.max(0, filteredOptions.findIndex((opt) => opt.value === value)),
    [filteredOptions, value]
  );
  const selectedOption = filteredOptions[selectedIndex];

  const longestRow = useMemo(() => {
    let label = '';
    let meta = '';
    let max = -1;
    for (const option of filteredOptions) {
      const candidate = option.label.length + (option.meta ? option.meta.length : 0);
      if (candidate > max) {
        max = candidate;
        label = option.label;
        meta = option.meta || '';
      }
    }
    return { label, meta };
  }, [filteredOptions]);

  const viewportHeight = menuPosition?.maxHeight ?? 320;

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      setScrollTop(0);
      setSearchQuery('');
      updateActiveIndex(selectedIndex);
      return;
    }
    const measureContent = () => {
      if (measureRef.current) {
        setContentWidth(measureRef.current.offsetWidth);
      }
    };
    measureContent();
    const measureTimer = window.setTimeout(measureContent, 0);
    const focusTimer = searchable
      ? window.setTimeout(() => searchRef.current?.focus(), 50)
      : 0;
    const container = containerRef.current;
    if (!container) {
      return () => {
        window.clearTimeout(measureTimer);
        window.clearTimeout(focusTimer);
      };
    }

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const viewportGap = 10;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placement: 'bottom' | 'top' =
        spaceBelow >= 180 || spaceBelow >= spaceAbove ? 'bottom' : 'top';
      const availableSpace = (placement === 'bottom' ? spaceBelow : spaceAbove) - viewportGap;
      const maxHeight = Math.max(120, Math.min(Math.floor(availableSpace), Math.floor(window.innerHeight * 0.7)));
      const anchorRight = rect.right > window.innerWidth - 96;
      setMenuPosition({ placement, maxHeight, anchorRight });
    };

    measure();
    const handleResize = () => {
      if (containerRef.current) measure();
    };
    const handleScroll = () => {
      if (containerRef.current) measure();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchField = event.target instanceof HTMLInputElement
        && containerRef.current?.contains(event.target);
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (searchQuery) {
          setSearchQuery('');
          setScrollTop(0);
        } else {
          setOpen(false);
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        keyboardNavRef.current = true;
        updateActiveIndex(Math.min(activeIndexRef.current + 1, filteredOptions.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        keyboardNavRef.current = true;
        updateActiveIndex(Math.max(activeIndexRef.current - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const current = activeIndexRef.current;
        if (current >= 0 && filteredOptions[current]) {
          onChange(filteredOptions[current].value);
          setOpen(false);
        }
      } else if (
        !isSearchField
        && event.key.length === 1
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && searchable
      ) {
        setSearchQuery((current) => current + event.key);
        setScrollTop(0);
      }
    };
    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(measureTimer);
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, filteredOptions, selectedIndex, updateActiveIndex, onChange, searchQuery, searchable]);

  const handleViewportScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) setScrollTop(viewport.scrollTop);
  }, []);

  const scrollActiveIntoView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const index = activeIndexRef.current;
    if (index < 0) return;
    const item = viewport.querySelector(`[data-option-index="${index}"]`);
    if (!item) return;
    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const itemTop = itemRect.top - viewportRect.top + viewport.scrollTop;
    const itemBottom = itemTop + itemRect.height;
    if (itemTop < viewport.scrollTop) {
      viewport.scrollTop = itemTop;
    } else if (itemBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = itemBottom - viewport.clientHeight;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!keyboardNavRef.current) return;
    scrollActiveIntoView();
  }, [open, activeIndex, scrollActiveIntoView]);

  useEffect(() => {
    if (open) keyboardNavRef.current = false;
  }, [open]);

  const heightClass = size === 'xs' ? 'h-8' : size === 'sm' ? 'h-10' : 'h-11';
  const totalHeight = filteredOptions.length * ROW_HEIGHT;
  const showSearch = searchable && filteredOptions.length > 0;
  const searchBarHeight = showSearch ? 45 : 0;
  const effectiveViewportHeight = Math.max(120, viewportHeight - searchBarHeight);
  const shouldVirtualize = filteredOptions.length > 0 && totalHeight > effectiveViewportHeight * 2;
  const menuWidth = contentWidth ? Math.min(contentWidth, 480) : null;
  const shouldTruncate = menuWidth !== null && menuWidth >= 480;

  const visibleRange = useMemo(() => {
    if (filteredOptions.length === 0) return { start: 0, end: 0 };
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(filteredOptions.length, Math.ceil((scrollTop + effectiveViewportHeight) / ROW_HEIGHT) + OVERSCAN);
    return { start, end };
  }, [filteredOptions.length, scrollTop, effectiveViewportHeight]);

  const renderedOptions = shouldVirtualize
    ? filteredOptions
        .slice(visibleRange.start, visibleRange.end)
        .map((option, index) => ({ option, optionIndex: visibleRange.start + index }))
    : filteredOptions.map((option, index) => ({ option, optionIndex: index }));

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
        <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-bit-text">
          {selectedOption?.label || 'Select…'}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-bit-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-[10200] mt-1.5 overflow-hidden rounded-xl border border-bit-border bg-bit-panel/95 shadow-2xl shadow-black/30 backdrop-blur-2xl ${
            menuPosition?.placement === 'top' ? 'mb-1.5 bottom-full' : 'top-full'
          } ${menuPosition?.anchorRight ? 'right-0' : 'left-0'}`}
          style={{
            minWidth: 'max(100%, 14rem)',
            maxWidth: 'min(30rem, calc(100vw - 1.5rem))',
            width: contentWidth ? Math.max(224, Math.min(contentWidth, 480)) : undefined,
          }}
        >
          {showSearch && (
            <div className="flex items-center gap-1.5 border-b border-bit-border/70 px-3 py-2">
              <Search size={14} className="shrink-0 text-bit-muted" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setScrollTop(0);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-7 w-full min-w-0 bg-transparent text-xs text-bit-text outline-none placeholder:text-bit-muted/70"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setScrollTop(0);
                    searchRef.current?.focus();
                  }}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-bit-muted transition-colors hover:bg-bit-panel hover:text-bit-text"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          <div
            ref={viewportRef}
            onScroll={handleViewportScroll}
            className="scrollbar-thin overflow-y-auto"
            role="listbox"
            aria-label={ariaLabel || label}
            style={{ maxHeight: effectiveViewportHeight }}
          >
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-bit-muted">No matches</p>
            ) : (
              <div
                className="relative w-full"
                style={{ height: shouldVirtualize ? totalHeight : undefined }}
              >
                {renderedOptions.map(({ option, optionIndex }) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    data-option-index={optionIndex}
                    onMouseEnter={() => {
                      keyboardNavRef.current = false;
                      updateActiveIndex(optionIndex);
                    }}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 whitespace-nowrap px-4 text-left text-xs font-semibold transition-colors ${
                      option.value === value
                        ? 'bg-bit-accent/10 text-bit-accent'
                        : optionIndex === activeIndex
                          ? 'bg-bit-accent/15 text-bit-accent'
                          : 'text-bit-muted hover:bg-bit-panel hover:text-bit-text'
                    }`}
                    style={{
                      height: ROW_HEIGHT,
                      ...(shouldVirtualize
                        ? { position: 'absolute', top: optionIndex * ROW_HEIGHT, left: 0, right: 0 }
                        : {}),
                    }}
                  >
                    <span className={`min-w-0 flex-1 ${shouldTruncate ? 'truncate' : ''}`}>{option.label}</span>
                    {option.meta && (
                      <span className="shrink-0 rounded-full border border-bit-border bg-bit-bg/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-bit-muted">
                        {option.meta}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <span
              ref={measureRef}
              aria-hidden="true"
              className="pointer-events-none fixed -left-[99999px] top-0 flex items-center gap-2 whitespace-nowrap px-4 text-xs font-semibold opacity-0"
            >
              <span>{longestRow.label}</span>
              {longestRow.meta && (
                <span className="shrink-0 rounded-full border border-bit-border bg-bit-bg/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-bit-muted">
                  {longestRow.meta}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppSelect;