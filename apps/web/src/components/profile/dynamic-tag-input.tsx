import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { discoveryApi } from '@/lib/discovery-api';

export interface TagLike {
  id: string;
  name: string;
  category: string;
  color: string;
  icon?: string | null;
}

export interface DynamicTagInputProps {
  value: TagLike[];
  onChange: (tags: TagLike[]) => void;
  maxTags?: number;
}

const MAX_TAGS_DEFAULT = 15;

export function DynamicTagInput({ value, onChange, maxTags = MAX_TAGS_DEFAULT }: DynamicTagInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allTagsQuery = useQuery({
    queryKey: ['tags', 'all'],
    queryFn: () => discoveryApi.listTags(false),
  });

  const suggestQuery = useQuery({
    queryKey: ['tags', 'suggest', input],
    queryFn: () => discoveryApi.suggestTags(input),
    enabled: input.trim().length > 0,
  });

  const suggestions = useMemo(() => {
    const existing = allTagsQuery.data?.tags ?? [];
    const suggested = suggestQuery.data?.tags ?? [];
    const selectedIds = new Set(value.map((t) => t.id));
    const query = input.trim().toLowerCase();

    // Start with server suggestions if available, otherwise filter all tags client-side.
    const pool = suggested.length > 0 ? suggested : existing;
    const matches: Array<TagLike & { isNew?: boolean }> = pool.filter(
      (t) => !selectedIds.has(t.id) && t.name.toLowerCase().includes(query),
    );

    // If no exact match exists for the typed text, offer to create it.
    const exactMatch = existing.some((t) => t.name.toLowerCase() === query);
    if (query.length > 0 && !exactMatch) {
      matches.push({
        id: `__new__:${input.trim()}`,
        name: input.trim(),
        category: 'custom',
        color: '#c9f24c',
        icon: null,
        isNew: true,
      });
    }

    return matches.slice(0, 10);
  }, [allTagsQuery.data, suggestQuery.data, input, value]);

  const addTag = useCallback(
    (tag: TagLike) => {
      if (value.length >= maxTags) return;
      if (value.some((t) => t.id === tag.id)) return;
      onChange([...value, tag]);
      setInput('');
      setOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange, maxTags],
  );

  const removeTag = useCallback(
    (tagId: string) => {
      onChange(value.filter((t) => t.id !== tagId));
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const first = suggestions[0];
        if (first) addTag(first);
      } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
        onChange(value.slice(0, -1));
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [input, suggestions, addTag, value, onChange],
  );

  return (
    <div className="relative">
      {/* Selected tag badges */}
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 border border-foreground bg-foreground/5 px-2 py-0.5 font-mono text-[11px] font-bold uppercase"
            style={{ clipPath: 'polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px))' }}
          >
            {tag.icon ? `${tag.icon} ` : ''}{tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
              aria-label={`Remover ${tag.name}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      {value.length < maxTags && (
        <div className="relative mt-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Digite para buscar ou criar interesses…"
            className="w-full border-2 border-white/15 bg-transparent px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-[#c9f24c] focus:outline-none"
          />

          {/* Typeahead dropdown */}
          {open && suggestions.length > 0 && (
            <div
              ref={listRef}
              className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto border-2 border-white/15 bg-card shadow-lg"
            >
              {suggestions.map((tag) => {
                const isNew = (tag as TagLike & { isNew?: boolean }).isNew;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addTag(tag);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-sm hover:bg-muted"
                  >
                    {isNew ? (
                      <span className="text-[#c9f24c]">+ Criar &quot;{tag.name}&quot;</span>
                    ) : (
                      <>
                        {tag.icon && <span>{tag.icon}</span>}
                        <span className="font-bold uppercase">{tag.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{tag.category}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value.length >= maxTags && (
        <p role="status" className="mt-1 font-mono text-[10px] uppercase text-amber-600">
          Limite de {maxTags} interesses atingido
        </p>
      )}
    </div>
  );
}
