"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { MediaGrid } from "@/components/media/MediaGrid";
import {
  ACCOUNT_QUERY_KEYS,
  deleteListMutation,
  getListQuery,
  removeListItemsMutation,
  updateListMutation,
} from "@/lib/tmdb/account-queries";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import { MediaType, type TrendingItem } from "@/lib/tmdb/queries";
import { AccountPageShell, EmptyNotice, SignedOutNotice } from "./AccountPageShell";
import { useAccount } from "./AccountProvider";

/**
 * One custom list: what is on it, and the three things only its owner can do —
 * rename it, take a title off it, and destroy it.
 */
export function AccountListDetail({ listId }: { listId: number }) {
  const { account, ready } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingItems, setEditingItems] = useState(false);

  const list = useQuery({
    ...getListQuery({ variables: { list_id: listId, page } }),
    enabled: Boolean(account),
    retry: false,
  });

  const invalidate = () => {
    for (const key of ACCOUNT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const rename = useMutation({
    ...updateListMutation(),
    onSuccess: () => {
      setRenaming(false);
      invalidate();
    },
  });
  const removeItems = useMutation({ ...removeListItemsMutation(), onSuccess: invalidate });
  const destroy = useMutation({
    ...deleteListMutation(),
    onSuccess: () => {
      invalidate();
      router.push("/my/lists");
    },
  });

  const name = list.data?.name ?? "List";
  const items = list.data?.results ?? [];
  const totalPages = list.data?.total_pages ?? 1;

  return (
    <AccountPageShell
      title={list.data ? name : "List"}
      blurb={list.data?.description || "A list you keep on TMDB."}
      count={list.data ? list.data.item_count : undefined}
      actions={
        list.data && !renaming && !confirmingDelete ? (
          <>
            <HeaderButton
              label={editingItems ? "Done" : "Edit titles"}
              icon={editingItems ? Check : Pencil}
              onClick={() => setEditingItems((was) => !was)}
            />
            <HeaderButton
              label="Rename"
              icon={Pencil}
              onClick={() => {
                setDraftName(name);
                setRenaming(true);
              }}
            />
            <HeaderButton label="Delete list" icon={Trash2} onClick={() => setConfirmingDelete(true)} />
          </>
        ) : undefined
      }
    >
      {/* Three states, and they say different things. Not signed in is not the
          same as an empty list, and neither is the same as still loading. */}
      {!ready ? null : !account ? (
        <SignedOutNotice message="Sign in with TMDB to see the lists you keep there." />
      ) : list.isPending ? null : list.isError ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-surface/60 p-8">
          <p className="text-muted">That list could not be loaded. It may have been deleted, or it may not be yours.</p>
          <Link
            href="/my/lists"
            className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Back to your lists
          </Link>
        </div>
      ) : (
        <>
          {renaming && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = draftName.trim();
                if (!trimmed || rename.isPending) return;
                rename.mutate({ list_id: listId, name: trimmed });
              }}
              className="mt-6 flex max-w-lg items-center gap-2"
            >
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={80}
                aria-label="List name"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/25 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draftName.trim() || rename.isPending}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
              >
                {rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </form>
          )}

          {/* A confirmation step because this is not our data to lose: deleting
              here deletes the list from the viewer's own TMDB account, where
              nothing we run can put it back. */}
          {confirmingDelete && (
            <div className="mt-6 max-w-lg rounded-2xl border border-white/10 bg-surface/60 p-6">
              <p className="text-sm text-white">Delete “{name}”?</p>
              <p className="mt-1 text-sm text-muted">
                This removes the list from your TMDB account for good. The titles on it stay in your watchlist and ratings.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => destroy.mutate({ list_id: listId })}
                  disabled={destroy.isPending}
                  className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
                >
                  {destroy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete permanently
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Keep it
                </button>
              </div>
              {destroy.isError && <p className="mt-3 text-sm text-red-300">That did not work. The list is still there.</p>}
            </div>
          )}

          {items.length === 0 ? (
            <EmptyNotice message="Open any film or show and add it from the action row." />
          ) : editingItems ? (
            <ul className="mt-8 max-w-3xl divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-surface/60">
              {items.map((item) => (
                <li key={`${item.media_type}-${item.id}`}>
                  <RemovableRow
                    item={item}
                    busy={removeItems.isPending && removeItems.variables?.items[0]?.media_id === item.id}
                    onRemove={() =>
                      removeItems.mutate({
                        list_id: listId,
                        items: [{ media_type: item.media_type ?? MediaType.movie, media_id: item.id }],
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <MediaGrid className="mt-8" items={items} />
          )}

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
    </AccountPageShell>
  );
}

function HeaderButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Pencil; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/**
 * A row rather than a cross laid over a poster: this is the editing surface, and
 * on a television a column of ordinary buttons is something a D-pad can walk,
 * where a badge floating over artwork is a target it has to hunt for.
 */
function RemovableRow({ item, busy, onRemove }: { item: TrendingItem; busy: boolean; onRemove: () => void }) {
  const title = item.title || item.name || "Untitled";
  const poster = getTMDBImageUrl(item.poster_path, "w92");
  const type = item.media_type ?? MediaType.movie;

  return (
    <div className="flex items-center gap-4 p-3">
      <Link href={`/media/${type}/${item.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
        ) : (
          <span className="h-16 w-11 shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{title}</span>
          <span className="block text-xs text-muted">{type === MediaType.movie ? "Movie" : "TV"}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remove ${title} from this list`}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Remove
      </button>
    </div>
  );
}
