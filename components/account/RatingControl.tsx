"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { ACCOUNT_QUERY_KEYS, clearRatingMutation, getAccountStatesQuery, setRatingMutation } from "@/lib/tmdb/account-queries";
import type { MediaType } from "@/lib/tmdb/queries";
import { cn } from "@/lib/utils";
import { useAccount } from "./AccountProvider";

/** TMDB accepts 0.5–10 in half steps; whole numbers keep the row to ten targets. */
const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * The viewer's own score for a title, out of ten.
 *
 * Ten buttons rather than a slider, and that is a TV requirement rather than a
 * preference: `ownsArrow` in lib/tv/spatial-nav.ts hands left and right to a
 * focused `<input>`, which is exactly the axis a row of stars needs — a range
 * input would swallow every press and the remote could never move along it.
 * Buttons keep left/right for navigation and leave up/down to exit the row.
 *
 * Rating matters beyond the number: TMDB builds its personal recommendations
 * from what an account has rated, so this is what makes that rail worth having.
 */
export function RatingControl({ type, id }: { type: MediaType; id: number }) {
  const { account } = useAccount();
  const queryClient = useQueryClient();

  const states = useQuery({
    ...getAccountStatesQuery({ variables: { media_type: type, media_id: id, account_id: account?.accountId ?? 0 } }),
    enabled: Boolean(account),
    staleTime: 0,
    retry: false,
  });

  const invalidate = () => {
    for (const key of ACCOUNT_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
  };

  const rate = useMutation({ ...setRatingMutation(), onSuccess: invalidate });
  const clear = useMutation({ ...clearRatingMutation(), onSuccess: invalidate });

  if (!account) return null;

  const rated = states.data?.rated;
  const current = rated ? rated.value : 0;
  const busy = rate.isPending || clear.isPending;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-muted">{current ? `You rated this ${current}/10` : "Rate this"}</span>

      <div
        // A group rather than a radiogroup: radiogroup promises arrow-key
        // selection and a single tab stop, and this is ten ordinary buttons the
        // D-pad walks. Claiming the richer role and not implementing it is worse
        // than claiming the plain one — the search scope chips make the same call.
        role="group"
        aria-label={`Rate out of 10${current ? `, currently ${current}` : ""}`}
        className="flex items-center gap-0.5"
      >
        {SCALE.map((value) => {
          const filled = value <= current;
          return (
            <button
              key={value}
              type="button"
              disabled={busy}
              // Clicking the score it already has clears it, which is what a
              // viewer reaches for when they mean "actually, no rating" — the
              // alternative is a separate remove control for a rare action.
              onClick={() =>
                value === current
                  ? clear.mutate({ media_type: type, media_id: id })
                  : rate.mutate({ media_type: type, media_id: id, value })
              }
              aria-label={value === current ? `Clear your rating of ${value}` : `Rate ${value} out of 10`}
              aria-pressed={filled}
              className={cn(
                "rounded-md p-1 transition-colors disabled:opacity-50",
                filled ? "text-amber-400" : "text-white/25",
                !busy && "hover:text-amber-400",
              )}
            >
              <Star className={cn("h-5 w-5", filled && "fill-current")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
