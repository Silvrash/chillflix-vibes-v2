/**
 * D-pad ("spatial") navigation for the Google TV WebView build.
 *
 * TV remotes emit arrow keys, but browsers only move focus with Tab — so the
 * arrows would just scroll the page. This intercepts the arrows and moves focus
 * to the nearest focusable element in the pressed direction (geometry-based),
 * then scrolls it into view. It's only wired up in TV mode (see TVMode.tsx), so
 * desktop/keyboard users are unaffected.
 *
 * Cross-origin player iframes handle their own arrow keys: once focus is inside
 * one, its key events never reach this window, and while the <iframe> element
 * itself is focused we bail out so the provider's controls keep working.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

type Direction = "up" | "down" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  // getClientRects() is empty for display:none; a zero-size box is unreachable.
  return rect.width > 0 && rect.height > 0 && el.getClientRects().length > 0;
}

function candidates(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

/** Nearest focusable to `current` in `dir`, or null if nothing lies that way. */
function findNext(current: HTMLElement, dir: Direction): HTMLElement | null {
  const c = current.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates()) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;

    // `primary` = distance along the travel axis, `cross` = misalignment.
    let primary: number;
    let cross: number;
    switch (dir) {
      case "right":
        primary = dx;
        cross = Math.abs(dy);
        break;
      case "left":
        primary = -dx;
        cross = Math.abs(dy);
        break;
      case "down":
        primary = dy;
        cross = Math.abs(dx);
        break;
      case "up":
        primary = -dy;
        cross = Math.abs(dx);
        break;
    }

    if (primary <= 1) continue; // not actually in this direction
    if (cross > primary * 2 + 60) continue; // reject wild diagonal jumps

    // Weight misalignment heavily so we prefer the element straight ahead.
    const score = primary + cross * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

/**
 * Start intercepting D-pad keys. Returns a cleanup function that detaches the
 * listener (called on unmount).
 */
export function enableSpatialNavigation(): () => void {
  function onKeyDown(event: KeyboardEvent) {
    const dir = KEY_TO_DIRECTION[event.key];
    if (!dir || event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;

    const active = document.activeElement as HTMLElement | null;
    if (active) {
      const tag = active.tagName;
      // Let players and editable fields consume arrows themselves.
      if (tag === "IFRAME" || active.isContentEditable) return;
      // In a text field, left/right move the caret; up/down still navigate out.
      if ((tag === "INPUT" || tag === "TEXTAREA") && (dir === "left" || dir === "right")) return;
    }

    const current = active && active !== document.body && isVisible(active) && active.matches(FOCUSABLE) ? active : null;

    if (!current) {
      // Nothing focused yet — grab the first focusable and stop the page scroll.
      const first = candidates()[0];
      if (first) {
        first.focus();
        event.preventDefault();
      }
      return;
    }

    const next = findNext(current, dir);
    if (next) {
      next.focus();
      next.scrollIntoView({ block: "nearest", inline: "nearest" });
      event.preventDefault();
    }
  }

  // Capture phase so we preempt the browser's default arrow-key scrolling.
  window.addEventListener("keydown", onKeyDown, true);

  // Give the page a moment to render, then land focus somewhere sensible.
  const initialFocus = window.setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    const main = document.querySelector("main") ?? document;
    main.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, 400);

  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.clearTimeout(initialFocus);
  };
}
