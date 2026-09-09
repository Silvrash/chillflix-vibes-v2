"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ListPlus, Loader2, Plus } from "lucide-react";
import {
  ACCOUNT_QUERY_KEYS,
  addListItemsMutation,
  createListMutation,
  getAccountListsQuery,
  getListItemStatusQuery,
  removeListItemsMutation,
  type ListSummary,
} from "@/lib/tmdb/account-queries";
import type { MediaType } from "@/lib/tmdb/queries";
import { cn } from "@/lib/utils";
import { useAccount } from "./AccountProvider";

/**
 * How many lists get a membership tick.
 *
 * TMDB has no "which of my lists hold this title" endpoint. The only honest
 * answer is `4/list/{id}/item_status`, one request per list, so an account with
 * forty lists would fire forty requests every time this menu opened. The rest of
 * the lists are still shown and still work — the row just offers adding rather
 * than claiming to know, which is exactly what is true.
 */
const TICKED_LISTS = 12;

/**
 * "Add to list", for one title.
 *
 * An anchored dropdown in the shape `DownloadMenu` established on this page,
 * not a modal: `lib/tv/spatial-nav.ts` treats an overlay as a trap to stay
 * inside, and a menu the D-pad cannot walk out of is worse than one it can.
 *
 * Self-contained like `TitleActions`, taking only the id and the media type, so
 * `DetailHero`'s hand-threaded prop list does not grow. Nothing is fetched until
 * the menu is opened; signed out it renders nothing at all.
 */
export function AddToListMenu({ type, id }: { type: MediaType; id: number }) {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);

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

  // `page` is spelled out rather than left to TMDB's default so this shares a
  // query key — and so a cache entry — with /my/lists rather than fetching the
  // same first page under a second one.
  const lists = useQuery({
    ...getAccountListsQuery({ variables: { account_object_id: account?.accountObjectId ?? "", page: 1 } }),
    enabled: open && Boolean(account),
    retry: false,
  });

  const all = lists.data?.results ?? [];
  const ticked = all.slice(0, TICKED_LISTS);

  const statuses = useQueries({
    queries: ticked.map((list) => ({
      ...getListItemStatusQuery({ variables: { list_id: list.id, media_id: id, media_type: type } }),
      enabled: open && Boolean(account),
      // TMDB answers 404 when the title is not on the list, so a retry would
      // only repeat a question already answered.
      retry: false,
      staleTime: 0,
    })),
  });

  const membership = new Map<number, boolean>();
  ticked.forEach((list, index) => membership.set(list.id, statuses[index]?.data?.success === true));

  const invalidate = () => {
    for (const key of ACCOUNT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const add = useMutation({ ...addListItemsMutation(), onSuccess: invalidate });
  const remove = useMutation({ ...removeListItemsMutation(), onSuccess: invalidate });
  const create = useMutation({
    ...createListMutation(),
    onSuccess: (created) => {
      setName("");
      // Creating a list from a title's page means putting that title in it —
      // the alternative is an empty list and a second trip through this menu.
      if (created?.id) add.mutate({ list_id: created.id, items: [{ media_type: type, media_id: id }] });
      else invalidate();
    },
  });

  if (!account) return null;

  const busyWith = (listId: number) =>
    (add.isPending && add.variables?.list_id === listId) || (remove.isPending && remove.variables?.list_id === listId);

  const toggle = (list: ListSummary) => {
    const items = [{ media_type: type, media_id: id }];
    if (membership.get(list.id)) remove.mutate({ list_id: list.id, items });
    else add.mutate({ list_id: list.id, items });
  };

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/20"
      >
        <ListPlus className="h-4 w-4" />
        Add to list
        <ChevronDown className={cn("h-4 w-4 text-white/60 transition-transform", open && "rotate-180")} />
      </button>

      {/* No `role="menu"` on the panel: it promises arrow-key selection and one
          tab stop, and this is ordinary buttons plus a text field the D-pad
          walks. Claiming the richer role without implementing it reads worse
          than the plain one — the rating row makes the same call. */}
      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-[26rem] w-[22rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-1.5 backdrop-blur-2xl">
          {lists.isPending ? (
            <p className="px-3 py-2 text-sm text-muted">Loading your lists…</p>
          ) : lists.isError ? (
            <p className="px-3 py-2 text-sm text-muted">Could not reach your lists. Try again in a moment.</p>
          ) : all.length === 0 ? (
            <p className="px-3 pb-1 pt-2 text-sm text-muted">No lists yet. Name one below.</p>
          ) : (
            all.map((list) => (
              <ListRow
                key={list.id}
                list={list}
                busy={busyWith(list.id)}
                // Beyond the tick budget membership is unknown, so the row says
                // "add" rather than guessing at a state it was never told.
                member={membership.has(list.id) ? membership.get(list.id)! : undefined}
                onClick={() => toggle(list)}
              />
            ))
          )}

          {all.length > TICKED_LISTS && (
            <p className="px-3 pb-1 pt-1.5 text-[11px] leading-snug text-muted">
              Ticks cover the first {TICKED_LISTS} lists — TMDB will only answer that one list at a time.
            </p>
          )}

          {/* One page of lists is all TMDB returns, so past that the full page is
              the only way to reach the rest. */}
          {(lists.data?.total_pages ?? 1) > 1 && (
            <Link
              href="/my/lists"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              See all your lists
            </Link>
          )}

          <div aria-hidden className="my-1.5 h-px bg-white/10" />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed || create.isPending) return;
              // Private unless the viewer publishes it themselves on TMDB: a list
              // made in passing from an action row is not a thing anyone asked to
              // put on their public profile.
              create.mutate({ name: trimmed, iso_639_1: "en", public: false });
            }}
            className="flex items-center gap-1.5 p-1"
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder="New list name"
              aria-label="New list name"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              aria-label="Create list"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ListRow({
  list,
  member,
  busy,
  onClick,
}: {
  list: ListSummary;
  /** Undefined where membership was never looked up. */
  member: boolean | undefined;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={member ?? false}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/60" />
        ) : member ? (
          <Check className="h-4 w-4 text-white" />
        ) : (
          <Plus className="h-4 w-4 text-white/40" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{list.name}</span>
      <span className="shrink-0 text-xs text-muted">{list.number_of_items}</span>
    </button>
  );
}
