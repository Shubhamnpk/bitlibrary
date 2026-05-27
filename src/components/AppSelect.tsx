import React from 'react';
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
  const heightClass = size === 'sm' ? 'h-10' : 'h-11';

  return (
    <label className={`relative inline-flex ${heightClass} min-w-0 items-center gap-2 rounded-lg border border-bit-border bg-bit-panel/25 px-3 text-bit-muted transition-colors focus-within:border-bit-accent/50 ${className}`}>
      {icon && <span className="shrink-0 text-bit-accent">{icon}</span>}
      {label && (
        <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-bit-muted">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel || label}
        className={`min-w-0 flex-1 appearance-none bg-transparent pr-7 text-xs font-semibold text-bit-text outline-none ${selectClassName}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-bit-bg text-bit-text">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 text-bit-muted" size={14} />
    </label>
  );
};

export default AppSelect;
