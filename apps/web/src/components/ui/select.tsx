import { useEffect, useRef, useState } from 'react';

export interface ThemedSelectOption {
  value: string;
  label: string;
}

export interface ThemedSelectProps {
  value: string;
  options: ThemedSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

/** Brutalist listbox: native selects can't be fully themed, so we roll our own. */
export function ThemedSelect({ value, options, onChange, ariaLabel, className = '' }: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between border-2 border-[#c9ced8]/40 bg-transparent px-2 font-mono text-xs text-foreground transition-colors hover:border-[#c9ced8]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f24c]"
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <span aria-hidden className="ml-2 text-[10px] text-muted-foreground">▼</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto border-2 border-[#c9ced8]/50 bg-[#0d0d0f] shadow-[6px_6px_0_0_rgba(201,206,216,0.15)]"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-2 py-1.5 text-left font-mono text-xs transition-colors ${
                    active
                      ? 'bg-[#c9f24c] font-bold text-black'
                      : 'text-foreground hover:bg-[#c9f24c]/15'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
