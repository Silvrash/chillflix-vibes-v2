/**
 * D-pad ("spatial") navigation for the Google TV WebView build.
 *
 * TV remotes emit arrow keys, but browsers only move focus with Tab — so the
 * arrows would just scroll the page. This intercepts the arrows and moves focus
 * to the nearest focusable element in the pressed direction (geometry-based),
 * then scrolls it into view. It's only wired up in TV mode (see TVMode.tsx), so
 * desktop/keyboard users are unaffected.
 *
 * The arrows are borrowed, never owned. A focused native control already
 * answers them — the caret steps, the value changes — and on a remote that
 * answer is the only one the viewer has, so taking the key away from the
 * control does not make it awkward, it makes it unusable. `ownsArrow` below is
 * where that line is drawn.
 *
 * A cross-origin frame is a one-way door: once focus is inside one its key
 * events never reach this window at all, so there is nothing left here to
 * intercept — which is why a page that lets a frame take focus unasked strands
 * the viewer. Whether a frame may hold focus is the page's call, and a page
 * makes it by handing the frame focus itself (see components/player/Player.tsx,
 * the one place that says yes, and how it hands back a way out). What this file
 * owes that call is never to make it on the page's behalf: an <iframe> is never
 * a destination the geometry search can walk onto, whatever tabindex it happens
 * to carry. That is the whole rule, so the next frame added to the site is
 * covered the day it is added rather than the day someone remembers it — a page
 * that wants a frame reachable gives the D-pad a control of its own to land on,
 * the way the player's box does. While an <iframe> is the active element we bail
 * out: those keys already belong to whatever is inside it.
 *
 * A dialog is the mirror of that door: while an overlay is open it is the only
 * place the geometry search looks, so a dialog's arrows cannot wander onto the
 * page underneath it. `inert` behind a dialog says the same thing and both are
 * kept: `inert` is the page's own declaration, and it covers Tab and the
 * pointer as well, which this cannot. But it is a declaration a dialog has to
 * remember to make, and the ones that forget must not hand the viewer controls
 * their own backdrop is covering — so containment is not left to the
 * declaration alone. `navigationRoot` below is the half enforced here.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Direction = "up" | "down" | "left" | "right";

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function isReachable(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  // getClientRects() is empty for display:none; a zero-size box is unreachable.
  if (rect.width <= 0 || rect.height <= 0 || el.getClientRects().length === 0) return false;
  // Asking for the attribute rather than trusting focus() to refuse: the TV
  // browsers this build targets are old enough to ignore `inert` outright, and
  // there the page behind a dialog would still take the focus it asked not to.
  return !el.closest("[inert]");
}

/** Everywhere the D-pad may land within `root` — frames excluded outright, per the note above. */
function candidates(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tagName !== "IFRAME" && isReachable(el));
}

/**
 * Something drawn over the page rather than in it: a dialog that says so, or a
 * box fixed to the viewport and covering it — which is what every sheet and
 * modal on this site is, backdrop included. `role="dialog"` is deliberately not
 * enough on its own; non-modal popovers wear it too, and the D-pad is meant to
 * be able to walk out of those.
 */
function isOverlay(el: HTMLElement): boolean {
  if (el.getAttribute("aria-modal") === "true") return true;
  const r = el.getBoundingClientRect();
  // clientWidth/Height rather than innerWidth/Height: a fixed box is laid out
  // inside the scrollbars, so on a platform that reserves room for them the
  // window's own measurements are a pixel span no overlay could ever match.
  const html = document.documentElement;
  if (r.left > 1 || r.top > 1 || r.right < html.clientWidth - 1 || r.bottom < html.clientHeight - 1) return false;
  return getComputedStyle(el).position === "fixed";
}

/**
 * Where the D-pad may travel while `el` holds focus: the overlay it sits in, or
 * the whole document when it sits in none. Anything behind an overlay is behind
 * a backdrop — invisible, and in a modal not the viewer's to operate — so
 * offering it as a destination is worse than offering nothing: the arrows go on
 * working and quietly drive the page the viewer cannot see. Confining the search
 * is also what makes the way out of a control inside a dialog a way out *into
 * the dialog*, rather than through its back wall.
 *
 * An overlay that opens without moving focus leaves it stranded behind the
 * backdrop, which is the same problem seen from the other side, so an open
 * overlay is the world even when focus has not reached it yet: the first arrow
 * press steps into the dialog instead of walking the buried page.
 */
function navigationRoot(el: Element): ParentNode {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (isOverlay(node)) return node;
  }
  return openOverlay() ?? document;
}

/**
 * The frontmost overlay currently on the page, if any. Only body's own children
 * are considered because that is where every overlay here is portalled, and the
 * last of them is the one opened most recently and so the one in front. It has
 * to hold something focusable to count: an overlay with nothing to land on is
 * not a world the D-pad can be confined to, it is a dead end — and that test is
 * also what keeps a bare full-screen <iframe> page, which is an overlay by every
 * measure above, from swallowing navigation whole.
 */
function openOverlay(): HTMLElement | null {
  const children = Array.from(document.body.children);
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i];
    if (child instanceof HTMLElement && isOverlay(child) && candidates(child).length > 0) return child;
  }
  return null;
}

/**
 * Whether the focused control answers this arrow itself, and so must be left
 * alone to. A control keeps the axis its own behaviour lives on — the caret's
 * for a text field, the option list's for a select — because on a remote that
 * behaviour is the only way the viewer has of working the control: up and down
 * are how a <select> is changed, and the only way that holds everywhere, since
 * Enter, Space, Alt+ArrowDown and F4 each open the list on some platforms and
 * do nothing on the rest.
 *
 * A select keeps a vertical arrow only while it still has an option to move to
 * that way, and hands it back at that end of the list. What that buys is the
 * guarantee this note used to claim without having: no arrow is dead in both
 * roles at once. A key the control cannot act on always reaches navigation, so
 * when a press does nothing it is because nothing lies that way — a fact about
 * the layout, which the viewer can see, rather than about the control, which
 * they cannot. What it does not promise, and what nothing here can, is that
 * navigation has somewhere to put the key: that is the layout's to answer.
 *
 * The claim it replaces was that each control leaves navigation an axis, and
 * that something is always left over. Both are true and neither is enough — a
 * free axis only promises the key reaches the geometry search, never that the
 * search has a target on it. That is how a select in the filter sheet came to
 * have no way out at all: it held up and down at every position, and its free
 * axis pointed at controls the sheet's own backdrop was covering.
 */
function ownsArrow(el: HTMLElement, dir: Direction): boolean {
  if (el.isContentEditable) return true;

  const horizontal = dir === "left" || dir === "right";
  switch (el.tagName) {
    case "IFRAME":
      return true;
    case "INPUT":
    case "TEXTAREA":
      return horizontal;
    case "SELECT":
      return !horizontal && canStepOption(el as HTMLSelectElement, dir);
    default:
      return false;
  }
}

/**
 * Whether `dir` still moves the selection inside `select`. Scanning for the next
 * option that can actually be selected rather than trusting the index alone: a
 * disabled option at the end of a list is one the select skips over and so has
 * no answer for, and treating it as an answer would strand focus exactly where
 * an end-of-list index would. An empty select, and the -1 index of one with
 * nothing chosen, fall out of the scan on their own.
 */
function canStepOption(select: HTMLSelectElement, dir: Direction): boolean {
  const step = dir === "up" ? -1 : 1;
  for (let i = select.selectedIndex + step; i >= 0 && i < select.options.length; i += step) {
    const option = select.options[i];
    const group = option.parentElement;
    if (!option.disabled && !(group instanceof HTMLOptGroupElement && group.disabled)) return true;
  }
  return false;
}

/** Nearest focusable to `current` in `dir`, or null if nothing lies that way. */
function findNext(current: HTMLElement, dir: Direction): HTMLElement | null {
  const c = current.getBoundingClientRect();
  const cx = c.left + c.width / 2;
  const cy = c.top + c.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates(navigationRoot(current))) {
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
    if (active && ownsArrow(active, dir)) return;

    const current = active && active !== document.body && isReachable(active) && active.matches(FOCUSABLE) ? active : null;

    if (!current) {
      // Nothing focused yet — grab the first focusable and stop the page scroll.
      const first = candidates(navigationRoot(active ?? document.body))[0];
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
