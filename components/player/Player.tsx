"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

interface PlayerProps {
  /**
   * The provider's embed URL, or `null` while the page is still working out
   * which one it is — an anime title waiting on its AniList id, or a bare watch
   * URL waiting to read where the viewer left off. The box is drawn either way;
   * only the frame waits.
   */
  src: string | null;
  title?: string;
  /**
   * Run before the gate opens, and awaited: the page's chance to make the
   * history entry this is about to push on top of one it can be returned to.
   * See `releasePosition` in WatchView — the entry left underneath is what Back
   * lands on, and a page that keeps writing the position into the entry above
   * it leaves that one describing an episode ago.
   */
  onBeforeEngage?: () => void | Promise<void>;
}

/**
 * The provider's frame, and — on a television — the gate in front of it.
 *
 * The frame is cross-origin, and that is the whole problem: the moment it holds
 * focus, every key the remote sends goes to the provider's document and this
 * page receives nothing at all. There is no listening our way out of it and no
 * reaching into it, so the only thing this page can decide is *whether* the
 * frame holds focus. The provider's script focuses itself some seconds after
 * load, which on a television left the viewer with no way back to the page: not
 * to the source picker — their only answer to a provider that won't play — nor
 * to prev/next, the season control or the episode list.
 *
 * So in TV mode the frame starts sealed and the player box itself is what the
 * D-pad lands on — from the first paint, before there is even a source to put
 * in it. OK opens the gate and hands the frame the focus the provider's own
 * controls need; Back closes it again. Back is the one key that still means
 * something once the frame has focus, because the browser acts on it itself
 * instead of handing it to the focused document — so opening the gate pushes a
 * history entry for it to pop, and the pop is heard here whatever has focus.
 * Both halves are spelled out on screen while the box is focused; a remote-only
 * way back that nobody can find is not a way back.
 *
 * Sealing the frame at mount is not the end of it, because the provider can
 * take focus later and from the inside, where `inert` does not reach and no
 * event on this side fires. That is why the seal is a standing condition and
 * not a one-off, and why what it restores is the control the viewer was
 * actually sitting on: a steal is not a move they made, and answering it by
 * parking them on the player box loses their place just as silently.
 *
 * That is also why nothing about the way out is allowed to disappear entirely.
 * The full sentence fades — it would otherwise sit over the film for two hours
 * — but a small marked Back stays, and the box wears the focus ring for the
 * frame inside it, which cannot wear one itself. A viewer who looks up after
 * ten quiet minutes has to be able to see that the page is still there and
 * which key returns to it.
 *
 * None of this applies outside TV mode: with a pointer, a click already decides
 * what has focus and a click elsewhere takes it away again.
 */
export function Player({ src, title, onBeforeEngage }: PlayerProps) {
  // The frame is held in state rather than a ref because it comes and goes
  // under a box that stays: a new source is a new element (it is keyed on the
  // source), and the first source arrives into a box that has been standing
  // empty. The effects below have to run again for whichever frame is there — a
  // ref would leave the new one unsealed, which is the whole of what this
  // component exists to prevent.
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tvMode, setTvMode] = useState(false);
  const [engaged, setEngaged] = useState(false);

  // <TVMode> adds `tv` to <html> from an effect, and it sits after this in the
  // tree, so the class can land after this component has already mounted —
  // hence watching the attribute rather than reading it once.
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTvMode(root.classList.contains("tv"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // A frame with no source in it is not a gate: there is nothing behind it to
  // open. The box is still a tab stop (see `tabIndex` below) — it is just not a
  // button yet.
  const sealed = tvMode && src !== null && !engaged;

  // Where the remote was before the frame took it. Tracked, rather than assumed
  // to be the player box, because a steal is not something the viewer did: they
  // were sitting on the Season control, or an episode card, and putting them on
  // the box instead is still taking their place away without being asked.
  const lastFocused = useRef<HTMLElement | null>(null);

  // Sealing the frame, and keeping it sealed. `inert` covers the reach from
  // outside — the D-pad, a Tab — but it does not reach into the provider's own
  // document, and a script in there focusing one of its own elements is a steal
  // this side cannot refuse and cannot hear: no focus event of any kind fires
  // here, on the frame or anywhere else. So the condition is watched instead of
  // the keys, which by then are all going to the provider. `blur` is the sign
  // the steal usually gives; `focus` covers one made while the tab was in the
  // background, which had no focus to take and so no blur to give; the poll is
  // what catches a provider that waits — seconds, not the instant after load —
  // and browsers old enough that neither event can be relied on. It costs two
  // comparisons twice a second to be wrong about.
  useEffect(() => {
    if (!frame) return;
    if (!sealed) {
      frame.removeAttribute("inert");
      return;
    }
    frame.setAttribute("inert", "");

    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== frame) lastFocused.current = target;
    };

    // Whether the frame is holding the keys, which has two shapes. While the
    // steal stands, this document's `activeElement` is the frame. Afterwards it
    // can name an element of ours that is not in fact `:focus` — the focused
    // document is the provider's, so nothing here matches the pseudo-class, and
    // that mismatch is the only thing left on this side that still knows.
    const frameHoldsFocus = () => {
      const active = document.activeElement;
      if (active === frame) return true;
      if (!active || active === document.body || !document.hasFocus()) return false;
      return !active.matches(":focus");
    };

    let reclaiming = false;
    const reclaim = () => {
      if (reclaiming || !frameHoldsFocus()) return;
      reclaiming = true;
      try {
        // `window.focus()` first, and it is the whole of the cure. Focusing an
        // element of ours moves this document's `activeElement` and nothing
        // else: the keys go on arriving in the provider's document while the
        // ring sits on a control that is not really focused, which is exactly
        // how a viewer ended up watching the ring jump to the player box and
        // then finding that no key reached the page at all.
        window.focus();
        const back = lastFocused.current;
        if (back?.isConnected) back.focus({ preventScroll: true });
        // Whatever they were on can be gone or disabled by now, and a restore
        // that lands nowhere is the trap again. The box is always here.
        const active = document.activeElement;
        if (!active || active === document.body || active === frame) boxRef.current?.focus({ preventScroll: true });
      } finally {
        reclaiming = false;
      }
    };

    document.addEventListener("focusin", remember);
    window.addEventListener("blur", reclaim);
    window.addEventListener("focus", reclaim);
    const poll = window.setInterval(reclaim, 500);
    return () => {
      document.removeEventListener("focusin", remember);
      window.removeEventListener("blur", reclaim);
      window.removeEventListener("focus", reclaim);
      window.clearInterval(poll);
    };
  }, [sealed, frame]);

  // Focus follows the gate: into the frame when the viewer opens it, back onto
  // the player box when they leave, so the ring says where they now are. The
  // ref keeps the second half from firing on mount, when focus belongs wherever
  // the page put it.
  const wasEngaged = useRef(false);
  useEffect(() => {
    if (engaged) {
      wasEngaged.current = true;
      frame?.focus({ preventScroll: true });
      return;
    }
    if (!wasEngaged.current) return;
    wasEngaged.current = false;
    boxRef.current?.focus({ preventScroll: true });
  }, [engaged, frame]);

  useEffect(() => {
    if (!engaged) return;
    const leave = () => setEngaged(false);
    // Escape is heard only when the frame does not in fact hold focus — a
    // provider that never took it, or handed it back. The gate is then standing
    // open for nothing, and this closes it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("popstate", leave);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", leave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [engaged]);

  // A gate already opening. Asking the page to let go of the position is a
  // round trip, and two OK presses inside it would push two entries — one of
  // which Back could never reach, because the first pop closes the gate.
  const opening = useRef(false);
  const engage = useCallback(() => {
    if (engaged || opening.current) return;
    opening.current = true;
    void (async () => {
      try {
        // Asked first, and awaited: the push below duplicates whatever the URL
        // says at that moment, and the whole point of the release is that the
        // entry left underneath no longer names an episode. A release that
        // fails is not a reason to refuse the gate — that would leave OK doing
        // nothing at all, which is the one outcome worse than an entry that
        // names an episode ago.
        await Promise.resolve(onBeforeEngage?.()).catch(() => {});
        // Same URL, and the router's own state carried across, so the entry is a
        // duplicate of the one the viewer is on: popping it is a no-op for Next's
        // router and exists only to give Back something to undo. It also guarantees
        // there *is* somewhere to go back to, which a deep link opened cold has not.
        window.history.pushState({ ...window.history.state }, "", window.location.href);
        setEngaged(true);
      } finally {
        opening.current = false;
      }
    })();
  }, [engaged, onBeforeEngage]);

  // The loud hint has had its say (see `.tv-player-exit-hint` in globals.css,
  // whose fade this waits out) and the quiet marker takes over from it.
  const [hintAtRest, setHintAtRest] = useState(false);
  useEffect(() => {
    if (!engaged) {
      setHintAtRest(false);
      return;
    }
    const settle = window.setTimeout(() => setHintAtRest(true), 5000);
    return () => window.clearTimeout(settle);
  }, [engaged]);

  const onBoxKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // OK on a remote arrives as Enter; Space is the keyboard equivalent that
      // any element with a button role is expected to answer to.
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      engage();
    },
    [engage],
  );

  return (
    <div
      ref={boxRef}
      // In TV mode the box is a control — the thing the D-pad lands on and, once
      // there is a frame behind it, what OK opens. It is a tab stop from the
      // first paint either way: spatial navigation's opening focus takes the
      // first focusable thing on the page, so a box that only became one when
      // the source was worked out handed that to the source picker on whichever
      // cold load the AniList lookup was still in flight at. Outside TV mode it
      // is the plain frame it has always been: no tab stop, no role, no
      // handlers.
      role={sealed ? "button" : undefined}
      aria-label={sealed ? "Open player controls" : undefined}
      tabIndex={tvMode ? 0 : undefined}
      onClick={sealed ? engage : undefined}
      onKeyDown={sealed ? onBoxKeyDown : undefined}
      // `rounded-2xl` to match the detail page's trailer modal, which is the same
      // 16:9 video surface, and the control tracks, episode cards and panels this
      // sits among. The site's `rounded-xl` is for artwork tiles — posters and
      // stills — not for the largest box on the page.
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-2xl bg-black outline-none ring-1 ring-white/10",
        // globals.css rings whatever is focused in TV mode, and the frame does
        // match the `[tabindex]` half of that selector — an attribute selector
        // matches `tabindex="-1"` like any other value. What it never matches is
        // `:focus`: an <iframe> whose content document holds the focus is
        // `:focus-within`, not `:focus`, so the ring would never appear on the
        // one element the viewer is pointed at. The box wears it on the frame's
        // behalf instead, in the same two bands — the page's ground, then blue —
        // which is the whole of what tells a viewer across the room that their
        // remote is pointed at the player rather than at nothing.
        tvMode &&
          "focus-within:ring-[3px] focus-within:ring-blue-500 focus-within:ring-offset-[3px] focus-within:ring-offset-[#0a0a0a]",
      )}
    >
      {src === null ? (
        // No frame yet, so the box stands empty and says so. The spinner is
        // absolutely positioned rather than centred by the box itself:
        // globals.css's pre-`aspect-ratio` fallback for old TV browsers is
        // `height: 0` plus a padding-top, so the padding holds the 16:9 shape
        // while the content box is zero pixels tall — and anything laid out in
        // that content box lands outside the black rectangle it is supposed to
        // sit in the middle of.
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      ) : (
        <iframe
          // The state setter is stable, so React calls it only when the element
          // itself comes or goes — an inline callback would re-run every render.
          ref={setFrame}
          key={src}
          src={src}
          title={title ?? "Player"}
          // Never a D-pad destination in its own right: it is reached by opening
          // the gate, never by arrowing into it.
          tabIndex={tvMode ? -1 : undefined}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
          referrerPolicy="origin"
        />
      )}

      {sealed && (
        // Shown with the focus ring rather than always: together they read as
        // "this is selected, and here is what OK does with it".
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 opacity-0 transition-opacity duration-200 group-focus:opacity-100">
          <HintChip>
            <Key>OK</Key>
            <span>Player controls</span>
            <span className="h-4 w-px bg-white/20" />
            <Key>Back</Key>
            <span>Returns here</span>
          </HintChip>
        </span>
      )}

      {engaged && (
        <>
          {/* The way out, said once on the way in and then faded (see globals.css)
              so it is not parked over the film for the next two hours. Top right is
              the one corner providers leave alone: their title sits top left and
              the controls the viewer is reaching for run along the bottom. */}
          <span className="tv-player-exit-hint pointer-events-none absolute inset-x-0 top-0 flex justify-end p-4">
            <HintChip>
              <Key>Back</Key>
              <span>Leave player controls</span>
            </HintChip>
          </span>
          {/* What is left of it afterwards, and the reason the sentence is
              allowed to go: one key, named, in the same corner. Faded far enough
              to lose to the film and lit enough to answer "how do I get out of
              this?" without the viewer having to press something to find out. */}
          <span
            className={cn(
              "pointer-events-none absolute right-0 top-0 p-4 transition-opacity duration-700",
              hintAtRest ? "opacity-40" : "opacity-0",
            )}
          >
            <HintChip className="gap-1.5 px-2.5 py-1 text-xs">
              <Key>Back</Key>
              <span>Leave</span>
            </HintChip>
          </span>
        </>
      )}
    </div>
  );
}

function HintChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-lg border border-white/25 bg-white/10 px-1.5 py-0.5 font-sans text-xs font-bold tracking-wide">
      {children}
    </kbd>
  );
}
