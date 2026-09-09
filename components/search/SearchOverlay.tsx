"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchResults } from "./SearchResults";
import { SearchScopeChips } from "./SearchScopeChips";
import { getSeeAllDestination, useSearchResults, type SearchScope } from "./useSearchResults";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Search is a dialog over whatever page you are on, not a destination: typing never touches the
 * URL, so closing it leaves you exactly where you were, with the scroll position you had. The one
 * navigation it performs is the deliberate hand-off to a browse page for the full, paginated set.
 */
export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressedBackdrop = useRef(false);

  const state = useSearchResults(query, scope);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Everything behind the dialog goes inert: it takes the page out of the tab order and, on the
    // TV build, stops the D-pad's geometry search from driving focus into content it cannot see.
    const inerted: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child.contains(rootRef.current) || child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }

    // Escape belongs to the topmost dialog, and while this one is open that is this one. `inert`
    // stops pointers and focus but not keys, so the filter sheet, the sidebar sheet and the
    // trailer modal all still hear this keystroke on their own document listeners — closing
    // underneath us, and racing us to restore body scroll. Capturing on window puts us ahead of
    // every one of them, and stopping propagation there is what makes the claim true.
    function onWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.isComposing) return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onWindowKeyDown, true);

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onWindowKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Order matters: focus() is a silent no-op on a node that is still inert, and the keyboard
      // user would be dumped on <body>.
      for (const node of inerted) node.removeAttribute("inert");
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [open, onClose]);

  // Each opening starts clean rather than showing the answer to a question asked an hour ago.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setScope("all");
  }, [open]);

  if (!mounted || !open) return null;

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;

    // `tabIndex >= 0` keeps the scope chips' roving tabindex honest: only the checked one is a Tab
    // stop, so the wrap-around must not land on one of its unreachable siblings.
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.getClientRects().length > 0 && element.tabIndex >= 0,
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function pressBackdrop(event: MouseEvent<HTMLDivElement>) {
    pressedBackdrop.current = event.target === event.currentTarget;
  }

  /**
   * Only the bare scroll surface counts as backdrop — the gutters either side of the content
   * column. The column itself is a click target in its own right, and the gaps its children leave
   * between them (a rail's top margin, the padding under the last one) are inside it; a click
   * there is a miss, not a dismissal, and throwing the typed query away over one is brutal.
   * The press has to have started there too, or releasing a text selection outside the column
   * would close the dialog.
   */
  function dismissOnBackdrop(event: MouseEvent<HTMLDivElement>) {
    const onBackdrop = event.target === event.currentTarget && pressedBackdrop.current;
    pressedBackdrop.current = false;
    if (onBackdrop) onClose();
  }

  // Whatever is in the field beats the debounced term: someone who types and immediately hits
  // Enter means the letters they just typed. The term is the fallback for the window after the
  // field is cleared, while its results are still on screen.
  const handoffTerm = query.trim() || state.term;
  const seeAll = getSeeAllDestination(scope, handoffTerm);

  // Page one of each type is all this dialog ever holds, so Enter hands off to the full paginated
  // set rather than gambling the keystroke on whichever card happened to rank first.
  function seeAllResults() {
    if (!handoffTerm) return;
    onClose();
    router.push(seeAll.href);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    seeAllResults();
  }

  // Enter is handled on the field itself rather than left to the form's implicit submission, which
  // a browser only performs while the form holds exactly one field.
  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    seeAllResults();
  }

  const busy = state.isTyping || state.isFetching;

  // <TVMode> adds this class from an effect that runs after this component's own, so it is read
  // here, on the render that opens the dialog, rather than once on mount when it is still absent.
  const tv = document.documentElement.classList.contains("tv");

  const clearButton = (
    <button
      type="button"
      aria-label="Clear search"
      onClick={() => {
        setQuery("");
        inputRef.current?.focus();
      }}
      className={cn(
        tv
          ? "flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/20"
          : "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-white",
      )}
    >
      <X className="h-4 w-4" />
      {tv && "Clear"}
    </button>
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close search"
      className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/20"
    >
      <X className="h-4 w-4" />
      {/* A remote has no Escape key to name, so on a television the button names the action. */}
      {tv ? "Close" : <span className="hidden sm:inline">Esc</span>}
    </button>
  );

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-[80] flex flex-col" onKeyDown={trapFocus}>
      {/* Purely the ground: the dialog below covers the viewport, so dismissal is handled by the
          scroll region's own target check rather than by clicks reaching this layer. */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl" aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-label="Search" className="relative flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-white/10">
          <div
            className={cn(
              "mx-auto flex w-full max-w-6xl gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4",
              tv ? "flex-col" : "items-center",
            )}
          >
            {/* A remote has only the arrows, and a focused text field keeps left and right for its
                own caret — so anything sharing the field's row is a control the D-pad can never
                reach, and on a television that row shut the viewer in with no way out. Stacked
                above it, the way out is one press up; centred, because the geometry search rejects
                a target this far off the axis it is travelling on. */}
            {tv && (
              <div className="flex items-center justify-center gap-3">
                {closeButton}
                {query && !busy ? clearButton : null}
              </div>
            )}

            <form onSubmit={submit} className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onFieldKeyDown}
                placeholder="Search movies, shows and people"
                aria-label="Search movies, shows and people"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                // 16px minimum: anything smaller and iOS Safari zooms the page on focus.
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-12 pr-12 text-base outline-none backdrop-blur-xl transition-colors placeholder:text-muted focus:border-white/25 focus:bg-white/10 sm:py-3.5 sm:text-lg"
              />
              {busy ? (
                <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
              ) : query && !tv ? (
                clearButton
              ) : null}
            </form>

            {!tv && closeButton}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          onMouseDown={pressBackdrop}
          onClick={dismissOnBackdrop}
        >
          <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
            {state.term ? (
              <SearchResults state={state} scope={scope} onScopeChange={setScope} onNavigate={onClose} seeAll={seeAll} />
            ) : (
              <div className="flex flex-col items-center py-16 text-center sm:py-24">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
                  <Search className="h-7 w-7 text-muted" />
                </div>
                <h2 className="mt-6 text-xl font-bold sm:text-2xl">Find something to watch</h2>
                <p className="mt-2 max-w-md text-sm text-muted">
                  Search every film and series on ChillFlixVibes, and the people who made them.
                </p>
                <SearchScopeChips className="mt-6 justify-center" scope={scope} onScopeChange={setScope} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
