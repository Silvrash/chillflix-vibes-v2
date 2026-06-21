"use client";

import { ChevronDown } from "lucide-react";

interface SelectOption {
  label: string;
  value: number | string;
}

interface SelectProps {
  label?: string;
  value: number | string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-1">
      {label && <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-white/10 bg-surface px-4 py-2.5 pr-10 text-sm font-medium outline-none transition-colors hover:border-white/20 focus:border-primary"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-surface text-white">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  );
}
