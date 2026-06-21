"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function PresetSelect({ options, value, onChange }: PresetSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = options.filter((option) => option.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={containerRef} className="relative inline-block w-full max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:border-white/20"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-white/10 bg-surface shadow-xl">
          <div className="border-b border-white/10 p-2">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a preset"
              className="w-full rounded-md bg-surface-light px-3 py-1.5 text-sm outline-none placeholder:text-muted"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-4 py-2 text-sm text-muted">No presets</li>}
            {filtered.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-white/5",
                    option === value ? "font-semibold text-white" : "text-muted",
                  )}
                >
                  <span className="truncate">{option}</span>
                  {option === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
