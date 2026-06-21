import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query";

/**
 * Single source of truth for the React Query client config, shared by the
 * client provider (`app/providers.tsx`) and the server components that
 * prefetch + dehydrate data for SSR hydration.
 *
 * `staleTime > 0` is important: it stops the client from immediately
 * refetching data that was just hydrated from the server.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 min — metadata changes rarely
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      dehydrate: {
        // Also ship still-pending queries so streamed prefetches hydrate.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: always a fresh client (one per request/render).
 * Browser: a lazily-created singleton so navigations reuse the cache.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
