"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MediaGrid } from "@/components/media/MediaGrid";
import { interleave } from "@/components/home/rail-items";
import { getRecommendedMoviesQuery, getRecommendedTvQuery } from "@/lib/tmdb/account-queries";
import { MediaType } from "@/lib/tmdb/queries";
import { useAccount } from "./AccountProvider";
import { AccountPageShell, EmptyNotice, SignedOutNotice } from "./AccountPageShell";

/**
 * The whole of what TMDB suggests, where the home rail shows only its head.
 *
 * Not a fourth `AccountLibrary` kind, though it wears the same chrome: every collection that
 * component covers is addressed by the numeric v3 account id and sorted by when the viewer added
 * something, and this one is addressed by the v4 object id and has no `sort_by` at all — TMDB's own
 * relevance order is the only order it has. Threading a second id and an absent sort through that
 * component would cost more than the page it saves.
 */
export function AccountRecommendations() {
  const { account, ready } = useAccount();
  const accountObjectId = account?.accountObjectId ?? "";

  const movies = useQuery({
    ...getRecommendedMoviesQuery({ variables: { account_object_id: accountObjectId } }),
    enabled: Boolean(accountObjectId),
    retry: false,
  });
  const shows = useQuery({
    ...getRecommendedTvQuery({ variables: { account_object_id: accountObjectId } }),
    enabled: Boolean(accountObjectId),
    retry: false,
  });

  // Stamped from the endpoint rather than read off the item — the live results carry no media type
  // whatever the schema says — and taken in turn so the series half is not buried behind a full
  // page of films.
  const items = useMemo(() => {
    const films = (movies.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.movie }));
    const series = (shows.data?.results ?? []).map((item) => ({ ...item, media_type: MediaType.tv }));
    return interleave(films, series);
  }, [movies.data, shows.data]);

  const loading = movies.isPending || shows.isPending;

  return (
    <AccountPageShell
      title="Recommended for you"
      blurb="Built by TMDB from the titles you have rated and favourited. The more you mark, the closer these get."
      count={account && !loading ? items.length : undefined}
    >
      {/* The same three states the other collections have, and here the empty one is the most
          likely of them: this page is empty until the viewer has rated something, so it says what
          to do rather than that there is nothing. */}
      {!ready ? null : !account ? (
        <SignedOutNotice message="Sign in with TMDB and rate or favourite a few titles — these suggestions are built from your own account rather than from this device." />
      ) : loading ? null : items.length === 0 ? (
        <EmptyNotice message="Rate or favourite a few films and series, and TMDB will start suggesting things here. It can take a while to catch up after you do." />
      ) : (
        <MediaGrid className="mt-8" items={items} />
      )}
    </AccountPageShell>
  );
}
