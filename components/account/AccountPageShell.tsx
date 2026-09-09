"use client";

/**
 * The chrome every `/my` page wears.
 *
 * Shared rather than copied because the three states these pages have are the
 * whole point of them — not signed in is not an empty collection, and neither
 * is still loading — and a fourth page spelling that distinction slightly
 * differently is how it quietly stops being made. The branching itself stays
 * with each page, since only the page knows what "loading" means for it.
 */
export function AccountPageShell({
  title,
  blurb,
  count,
  countNoun = "title",
  actions,
  children,
}: {
  title: string;
  blurb: string;
  /** The pill beside the heading. Omitted while there is no honest number yet. */
  count?: number;
  countNoun?: string;
  /** Controls that belong to the page as a whole, laid beside the heading. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {count !== undefined && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted">
            {count} {count === 1 ? countNoun : `${countNoun}s`}
          </span>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <p className="mt-2 text-muted">{blurb}</p>
      {children}
    </div>
  );
}

export function SignedOutNotice({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-surface/60 p-8">
      <p className="text-muted">{message}</p>
      <a
        href="/api/account/login"
        className="mt-5 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
      >
        Sign in with TMDB
      </a>
    </div>
  );
}

export function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-surface/60 p-8">
      <p className="text-muted">Nothing here yet. {message}</p>
    </div>
  );
}
