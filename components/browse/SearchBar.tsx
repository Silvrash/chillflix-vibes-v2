"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import debounce from "debounce";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  initialValue?: string;
}

export function SearchBar({ placeholder = "Search", onSearch, initialValue = "" }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  const debouncedSearch = useMemo(() => debounce((query: string) => onSearch(query), 400), [onSearch]);

  useEffect(() => () => debouncedSearch.clear(), [debouncedSearch]);

  function update(next: string) {
    setValue(next);
    debouncedSearch(next);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-surface py-2.5 pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary placeholder:text-muted"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => update("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
