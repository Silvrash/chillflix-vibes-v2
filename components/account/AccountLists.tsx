"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Lock, Plus } from "lucide-react";
import { ACCOUNT_QUERY_KEYS, createListMutation, getAccountListsQuery, type ListSummary } from "@/lib/tmdb/account-queries";
import { AccountPageShell, EmptyNotice, SignedOutNotice } from "./AccountPageShell";
import { useAccount } from "./AccountProvider";

/**
 * The viewer's custom lists, and the place to make another.
 *
 * A list of lists rather than a `MediaGrid`: TMDB gives a list a poster only
 * once someone sets one, so a grid of these would be mostly empty cards.
 */
export function AccountLists() {
  const { account, ready } = useAccount();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");

  const lists = useQuery({
    ...getAccountListsQuery({ variables: { account_object_id: account?.accountObjectId ?? "", page } }),
    enabled: Boolean(account),
    retry: false,
  });

  const create = useMutation({
    ...createListMutation(),
    onSuccess: () => {
      setName("");
      setPage(1);
      for (const key of ACCOUNT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
    },
  });

  const results = lists.data?.results ?? [];
  const totalPages = lists.data?.total_pages ?? 1;
  const loading = lists.isPending;

  return (
    <AccountPageShell
      title="Your lists"
      blurb="Lists you keep on TMDB. They follow your account, not this device."
      count={account && !loading ? (lists.data?.total_results ?? results.length) : undefined}
      countNoun="list"
    >
      {/* Three states, and they say different things. Not signed in is not the
          same as having no lists, and neither is the same as still loading. */}
      {!ready ? null : !account ? (
        <SignedOutNotice message="Sign in with TMDB to keep lists that follow you between your browser, your TV and your Mac." />
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed || create.isPending) return;
              // Private unless the viewer publishes it on TMDB themselves. A list
              // made here was never a request to add something to a public profile.
              create.mutate({ name: trimmed, iso_639_1: "en", public: false });
            }}
            className="mt-8 flex max-w-lg items-center gap-2"
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="New list name"
              aria-label="New list name"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-muted focus:border-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create list
            </button>
          </form>

          {create.isError && <p className="mt-3 text-sm text-red-300">That list could not be created. Try again.</p>}

          {loading ? null : results.length === 0 ? (
            <EmptyNotice message="Name a list above, or start one from any title's page." />
          ) : (
            <>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((list) => (
                  <li key={list.id}>
                    <ListCard list={list} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </AccountPageShell>
  );
}

function ListCard({ list }: { list: ListSummary }) {
  return (
    <Link
      href={`/my/lists/${list.id}`}
      className="flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-surface/60 p-5 transition-colors hover:border-white/25 hover:bg-white/5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-white">{list.name}</span>
          {/* TMDB spells this 0/1 in the account listing and a boolean on the
              list itself, so both shapes have to read the same way here. */}
          {!list.public && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Private" />}
        </span>
        <span className="mt-1 block truncate text-sm text-muted">
          {list.number_of_items} {list.number_of_items === 1 ? "title" : "titles"}
          {list.description ? ` · ${list.description}` : ""}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
