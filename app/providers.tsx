"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { AccountProvider } from "@/components/account";
import { SearchOverlayProvider } from "@/components/search";
import { getQueryClient } from "@/lib/tmdb/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // Search sits inside the query client because the overlay fetches through it, and above the
  // whole tree because the navbar trigger, the ⌘K shortcut and the dialog itself all share one
  // open/closed state. The provider renders nothing on `/embed` on its own.
  return (
    <QueryClientProvider client={queryClient}>
      {/* Account sits inside the query client because its controls fetch through it, and above
          everything else because the navbar, the detail page and the home rails all read the
          same session. */}
      <AccountProvider>
        <SearchOverlayProvider>{children}</SearchOverlayProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}
