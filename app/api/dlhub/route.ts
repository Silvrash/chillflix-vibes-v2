import { NextResponse } from "next/server";

/**
 * Fetch download options for a title from dlhub.cc. dlhub is a title-search site
 * whose `POST /search` results already embed magnet (torrent) links with a name
 * in the `dn=` param — so we can surface direct magnet links instead of sending
 * the user off to dlhub's page. Cached hard since availability rarely changes.
 */
const DAY = 60 * 60 * 24;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

interface Download {
  name: string;
  magnet: string;
}

function decodeName(dn: string): string {
  try {
    return decodeURIComponent(dn.replace(/\+/g, " "));
  } catch {
    return dn.replace(/\+/g, " ");
  }
}

/** Pull unique magnet links (deduped by info-hash) out of the dlhub results HTML. */
function extractDownloads(html: string): Download[] {
  const matches = html.match(/magnet:\?xt=urn:btih:[^"'<>\s]+/gi) ?? [];
  const seen = new Set<string>();
  const downloads: Download[] = [];
  for (const escaped of matches) {
    const magnet = escaped.replace(/&amp;/g, "&");
    const hash = /btih:([A-Fa-f0-9]+)/.exec(magnet)?.[1]?.toUpperCase();
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    const dn = /[?&]dn=([^&]+)/.exec(magnet)?.[1];
    downloads.push({ name: dn ? decodeName(dn) : "Download", magnet });
    if (downloads.length >= 12) break;
  }
  return downloads;
}

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title")?.trim();
  if (!title) return NextResponse.json({ available: false, downloads: [] }, { status: 400 });

  try {
    const res = await fetch("https://dlhub.cc/search", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: new URLSearchParams({ q: title }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ available: false, downloads: [] });

    const downloads = extractDownloads(await res.text());
    return NextResponse.json(
      { available: downloads.length > 0, downloads },
      { headers: { "Cache-Control": `public, s-maxage=${DAY}, stale-while-revalidate=${DAY}` } },
    );
  } catch {
    return NextResponse.json({ available: false, downloads: [] });
  }
}
