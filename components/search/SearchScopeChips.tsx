"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { SearchKind } from "./search-queries";
import type { SearchScope } from "./useSearchResults";

const CHIPS: Array<{ value: SearchScope; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "Shows" },
  { value: "person", label: "People" },
];

export interface SearchScopeChipsProps {
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  counts?: Partial<Record<SearchKind, number>>;
  className?: string;
}

export function SearchScopeChips({ scope, onScopeChange, counts, className }: SearchScopeChipsProps) {
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * A radiogroup promises its own arrow keys, and announcing "1 of 4" while Tab walks all four is
   * a promise broken twice over. So: one Tab stop for the group (the checked chip), and the arrows
   * move the selection within it — which for radios means selecting as you go, not just focusing.
   *
   * Only the axis the chips are laid out along, though. A remote has nothing but the arrows, and a
   * group that answered all four would be a room with no door: these chips sit side by side, so up
   * and down are the only keys that can carry a D-pad out of them — to the field above, or the
   * results below. Left and right keep their wrap-around because the vertical way out is not
   * theirs to provide, and because a group with two rows of chips still needs them to reach the
   * end of one row from the other.
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The D-pad walks geometry, not the tab order, so it can leave focus on a chip that is not the
    // checked one. Step from wherever focus actually is, and fall back to the checked chip only
    // when the group holds none of it.
    const focused = chipRefs.current.findIndex((node) => node === document.activeElement);
    const current =
      focused >= 0
        ? focused
        : Math.max(
            CHIPS.findIndex((chip) => chip.value === scope),
            0,
          );

    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % CHIPS.length;
    else if (event.key === "ArrowLeft") next = (current + CHIPS.length - 1) % CHIPS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = CHIPS.length - 1;
    else return;

    // Arrows would otherwise scroll the results underneath the group instead of moving through it.
    event.preventDefault();
    onScopeChange(CHIPS[next].value);
    chipRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Limit results to a type"
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {CHIPS.map((chip, index) => {
        const active = chip.value === scope;
        const count = chip.value === "all" ? undefined : counts?.[chip.value];

        return (
          <button
            key={chip.value}
            ref={(node) => {
              chipRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onScopeChange(chip.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-black"
                : "border border-white/10 bg-white/10 text-muted backdrop-blur-xl hover:bg-white/20 hover:text-white",
            )}
          >
            {chip.label}
            {count !== undefined && count > 0 && (
              <span className={cn("text-xs tabular-nums", active ? "text-black/50" : "text-white/40")}>
                {count.toLocaleString("en-US")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
