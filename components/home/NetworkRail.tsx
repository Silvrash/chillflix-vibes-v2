"use client";

import { useState } from "react";
import Link from "next/link";
import { MediaRail } from "@/components/media/MediaRail";
import { getTMDBImageUrl } from "@/lib/tmdb/images";
import type { HomeNetworkTile } from "./rails";

/**
 * The row of network tiles.
 *
 * It is the one row on the home page that shows no titles, which is also why it claims nothing in
 * the shared "already shown" registry (./shown-titles.tsx) and takes no `order`: it can neither
 * take a title off a row below it nor give one up.
 *
 * No "See all" link, because there is nowhere for it to go — a page listing every network is a
 * longer version of this row, not a destination. Each tile is its own way in.
 */
export function NetworkRail({ title, tiles }: { title: string; tiles: HomeNetworkTile[] }) {
  return <MediaRail title={title} variant="logo" items={tiles} renderItem={(tile) => <NetworkTile tile={tile} />} />;
}

/**
 * `w300` because TMDB's logo sizes are their own set (w45…w500, original) and getTMDBImageUrl
 * defaults to a *poster* size, w342, which is not among them. It happens to answer 200 today; it is
 * not a size TMDB promises to keep serving.
 */
const LOGO_SIZE = "w300";

/**
 * One tile: the network's logo, centred on a neutral plate.
 *
 * The logos are drawn as white silhouettes, and that is a deliberate correction rather than a
 * style. TMDB's logo files are transparent PNGs carrying one flat brand colour each, and half of
 * this set — HBO Max, Apple TV+, Peacock, AMC, FX, Adult Swim — is pure black: 1.3:1 on a plate
 * this dark, an unreadable tile. The rest spread from Disney+'s teal (3.1:1 against the page's
 * #0a0a0a) to Hulu's green (12.1:1), so no one plate colour carries the set — make it light enough
 * for the black wordmarks and Hulu is the one that vanishes.
 *
 * `brightness-0 invert` paints every logo pure white instead, for at least 16.5:1 wherever it
 * lands on the plate. It costs almost nothing: ten of the twelve files have no second colour to
 * lose, and in the two that do (HBO Max's mark, Peacock's feathers) the colour sits in separate
 * shapes rather than in shading, so the drawing survives intact. What is left is a row of
 * monochrome marks on a page whose premise is that artwork is the only colour and chrome is not.
 */
function NetworkTile({ tile }: { tile: HomeNetworkTile }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = getTMDBImageUrl(tile.logoPath, LOGO_SIZE);

  return (
    <Link href={tile.href} prefetch={false} className="group block rounded-xl focus-visible:outline-none">
      {/* The aspect box is a full-width child of the link, never the rail's fixed-width flex item
          itself: globals.css falls back to `padding-top: 56.25%` for TV browsers older than
          `aspect-ratio`, percentage padding resolves against the *containing block's* width, and on
          a flex item that is the scroller's width rather than the tile's — a tile several thousand
          pixels tall. Keep the literal `aspect-video` too; the fallback is keyed on that name. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-surface-light to-surface ring-1 ring-white/10 transition duration-200 group-hover:scale-[1.03] group-hover:ring-white/25 group-focus-visible:scale-[1.03] group-focus-visible:ring-white/25">
        {/* Absolute rather than in flow, because the padding-top fallback above leaves the box
            zero-height: a centred child would be laid out against nothing. */}
        <span className="absolute inset-0 flex items-center justify-center px-5 py-4 sm:px-6 sm:py-5">
          {logo && !logoFailed ? (
            <img
              src={logo}
              // The logo is the tile's label, so it carries the name — and when the file fails the
              // name is drawn instead, rather than the tile becoming an unreadable empty plate.
              alt={tile.name}
              loading="lazy"
              onError={() => setLogoFailed(true)}
              className="max-h-full max-w-full object-contain brightness-0 invert"
            />
          ) : (
            <span className="text-center text-sm font-semibold tracking-tight text-white sm:text-base">{tile.name}</span>
          )}
        </span>
      </div>
    </Link>
  );
}
