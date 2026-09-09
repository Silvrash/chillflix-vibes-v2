"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, ListVideo, LogOut, User } from "lucide-react";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { cn } from "@/lib/utils";
import { useAccount } from "./AccountProvider";

const LINKS = [
  { href: "/my/watchlist", label: "Watchlist", icon: ListVideo },
  { href: "/my/favorites", label: "Favourites", icon: Heart },
];

/**
 * The navbar's account control: a sign-in link when signed out, a menu when in.
 *
 * Signed out it is an `<a>`, not a button, and that is deliberate twice over —
 * it works before React hydrates, and `a[href]` is in the focusable set
 * `lib/tv/spatial-nav.ts` walks, so a remote reaches it with no extra work.
 */
export function AccountMenu() {
  const { account, ready } = useAccount();
  const pathname = usePathname();

  // Nothing at all until the session is known: rendering "Sign in" first and
  // swapping to an avatar a moment later is worse than a beat of nothing, and
  // the pill is `max-w-fit` so it would visibly resize.
  if (!ready) return null;
  if (!account) {
    return (
      <a
        href={`/api/account/login?returnTo=${encodeURIComponent(pathname || "/")}`}
        className={cn(
          "relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white",
          // The same invisible hit area SearchTrigger uses: a 44px-tall control
          // would push the pill past its 36px logo.
          "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        )}
      >
        <User className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Sign in</span>
      </a>
    );
  }

  return <SignedInMenu account={account} pathname={pathname || "/"} />;
}

function SignedInMenu({ account, pathname }: { account: NonNullable<ReturnType<typeof useAccount>["account"]>; pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const avatar = account.avatarPath ? getTMDBImageUrl(account.avatarPath, "w45") : "";

  // Anchored panel rather than a modal, matching DownloadMenu on the detail
  // page: a dropdown is not an overlay by `spatial-nav`'s test, so a D-pad can
  // still walk out of it rather than being trapped.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account: ${account.username}`}
        className={cn(
          "relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-sm font-medium transition-colors",
          open ? "bg-white/10 text-white" : "text-muted hover:bg-white/5 hover:text-white",
          "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
        )}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold uppercase text-white">
            {account.username.slice(0, 1) || "?"}
          </span>
        )}
        <span className="hidden max-w-24 truncate sm:inline">{account.username}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border border-white/10 bg-black/80 p-1.5 backdrop-blur-2xl"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              <link.icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          ))}

          <div aria-hidden className="my-1.5 h-px bg-white/10" />

          {/*
            A real form POST, not a fetch. The redirect it answers with is a full
            document navigation, and that is what tears down the module-singleton
            QueryClient — whose 30-minute gcTime would otherwise keep this
            account's watchlist in memory while the next person signs in on the
            same tab. The navigation is the guarantee; clearing caches by hand
            would be a promise instead.
          */}
          <form action="/api/account/logout" method="post">
            <input type="hidden" name="returnTo" value={pathname} />
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
