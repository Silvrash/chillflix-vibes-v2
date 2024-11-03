import { VidSrcMe } from "@/api/streaming/vid-src.me";
import { VidSrcTo } from "@/api/streaming/vid-src.to";
import { AppendToResponse, MediaType } from "@/api/tmdb";
import { QueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Router } from "expo-router";

export function createURLSearchParams<T extends Array<[string, unknown] | undefined | readonly [string, unknown]>>(
  params: T,
): string {
  const searchParams = new URLSearchParams();
  params.forEach((param) => {
    if (typeof param === "undefined") return;
    const [key, value] = param;
    if (typeof value === "undefined") return;
    searchParams.set(key, String(value));
  });
  return Array.from(searchParams.entries()).length > 0 ? `?${searchParams.toString()}` : "";
}

export function parseGet(val?: object) {
  if (!val) return "";
  return encodeURIComponent(JSON.stringify(val));
}

export function normalizeRating(rating: number) {
  return rating.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function toMediaDetail(id: number, mediaType: MediaType) {
  return `/${mediaType}/${id}`;
}

export function appendToResponse(...append: AppendToResponse[]) {
  return append.join(",");
}

export function formatDate(date?: string | Date) {
  if (!date) return "";
  return format(new Date(date), "MMMM dd, yyyy");
}

export function getServers() {
  const servers = [
    { name: "Main Server", server: new VidSrcMe() },
    { name: "Alternative Server", server: new VidSrcTo() },
  ];

  return servers;
}

export function toSentenceCase(str: string) {
  return str.replace(/^\w/, (c) => c.toUpperCase());
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

export function mockWait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function goBack(router: Router) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.push("/");
  }
}
