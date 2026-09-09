"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Heart, Loader2 } from "lucide-react";
import {
  ACCOUNT_QUERY_KEYS,
  addToWatchlistMutation,
  getAccountStatesQuery,
  setFavoriteMutation,
} from "@/lib/tmdb/account-queries";
import type { MediaType } from "@/lib/tmdb/queries";
import { cn } from "@/lib/utils";
import { useAccount } from "./AccountProvider";

/**
 * Watchlist and favourite, for one title.
 *
 * Self-contained on purpose, in the shape `DownloadMenu` established on this
 * page: it takes the id and the media type and nothing else, so `DetailHero`'s
 * already hand-threaded prop list does not grow by four to carry account state
 * it has no other use for.
 *
 * Renders nothing at all when signed out, so the action row is byte-identical
 * to what it is today for anyone who never signs in.
 */
export function TitleActions({ type, id }: { type: MediaType; id: number }) {
  const { account } = useAccount();
  const queryClient = useQueryClient();

  const states = useQuery({
    ...getAccountStatesQuery({
      variables: { media_type: type, media_id: id, account_id: account?.accountId ?? 0 },
    }),
    enabled: Boolean(account),
    // The viewer's own state, which they can change on themoviedb.org in another
    // tab. Nothing here is worth serving stale.
    staleTime: 0,
    retry: false,
  });

  const invalidate = () => {
    for (const key of ACCOUNT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const watchlist = useMutation({ ...addToWatchlistMutation(), onSuccess: invalidate });
  const favorite = useMutation({ ...setFavoriteMutation(), onSuccess: invalidate });

  if (!account) return null;

  const onWatchlist = states.data?.watchlist ?? false;
  const isFavorite = states.data?.favorite ?? false;

  return (
    <>
      <ActionButton
        active={onWatchlist}
        busy={watchlist.isPending}
        // Reads as the state it is in, not the state it would move to: a button
        // labelled "Add" that is already lit is a puzzle.
        label={onWatchlist ? "On your watchlist" : "Add to watchlist"}
        icon={onWatchlist ? BookmarkCheck : Bookmark}
        onClick={() =>
          watchlist.mutate({ account_id: account.accountId, media_type: type, media_id: id, watchlist: !onWatchlist })
        }
      />
      <ActionButton
        active={isFavorite}
        busy={favorite.isPending}
        label={isFavorite ? "In your favourites" : "Add to favourites"}
        icon={Heart}
        iconClassName={isFavorite ? "fill-current" : undefined}
        onClick={() => favorite.mutate({ account_id: account.accountId, media_type: type, media_id: id, favorite: !isFavorite })}
      />
    </>
  );
}

function ActionButton({
  active,
  busy,
  label,
  icon: Icon,
  iconClassName,
  onClick,
}: {
  active: boolean;
  busy: boolean;
  label: string;
  icon: typeof Bookmark;
  iconClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      // A real <button>: `lib/tv/spatial-nav.ts` walks `button:not([disabled])`,
      // so a div with an onClick would be invisible to a remote — and a disabled
      // one is skipped, which is why `busy` also removes it from the D-pad path
      // rather than leaving a control that swallows presses.
      className={cn(
        "flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60",
        active
          ? "border-white/20 bg-white/20 text-white hover:bg-white/25"
          : "border-white/10 bg-white/10 text-white backdrop-blur-xl hover:bg-white/20",
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className={cn("h-4 w-4", iconClassName)} />}
      {label}
    </button>
  );
}
