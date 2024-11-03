import { Maybe } from "@/api/api";
import { differenceInMonths } from "date-fns";

interface ResponseData {
  id: string;
  quality: string;
}

export const QUALITY_MAPPING = new Map([
  ["1080p", "HD"],
  ["720p", "HD"],
  ["480p", "SD"],
  ["360p", "SD"],
  ["240p", "SD"],
  ["144p", "SD"],
]);

export async function checkQualities(ids: string[]): Promise<Map<string, Maybe<string>>> {
  "use client";

  const data = await fetch(`https://chillflixvibes.vercel.app/api/check_qualities?ids=${ids.join(",")}`, {})
    .then((res) => res.json())
    .then((res) => res.data as ResponseData[]);

  const map = new Map<string, Maybe<string>>(data.map((d) => [d.id, d.quality]));
  return map;
}

export async function checkQuality(id: string): Promise<Maybe<string>> {
  "use client";

  return fetch(`https://chillflixvibes.vercel.app/api/movie/${id}/api/check_quality`)
    .then((res) => res.json())
    .then((res) => res.quality);
}

export function evaluateQuality(quality: Maybe<string>, release_date: string) {
  if (!quality) {
    const release_year = new Date(release_date);

    if (differenceInMonths(release_year, new Date()) > 3) return "HD";
  } else return QUALITY_MAPPING.get(quality) ?? quality;
}
