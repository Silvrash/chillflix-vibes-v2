"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** What the browser is allowed to know about the viewer. Never a credential. */
export interface AccountProfile {
  accountId: number;
  accountObjectId: string;
  username: string;
  avatarPath: string | null;
}

interface AccountContextValue {
  account: AccountProfile | undefined;
  /** False until `/api/account/me` answers, so nothing flashes the wrong state. */
  ready: boolean;
}

const AccountContext = createContext<AccountContextValue>({ account: undefined, ready: false });

/**
 * Who is signed in, for the whole tree.
 *
 * It asks the server rather than reading a cookie, because the session cookie is
 * httpOnly and scoped to `/api/account` — deliberately unreachable from here.
 * The alternative, reading cookies in the root layout, would make every page
 * dynamic and destroy the detail page's 24-hour ISR and the static home page for
 * the sake of a name in the navbar. One fetch per load is the cheaper trade.
 *
 * Signed out is the default and costs nothing: the request returns
 * `{ signedIn: false }` and every account control renders nothing.
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AccountProfile | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : { signedIn: false }))
      .then((body: { signedIn?: boolean } & Partial<AccountProfile>) => {
        if (cancelled) return;
        setAccount(body.signedIn && typeof body.accountId === "number" ? (body as AccountProfile) : undefined);
      })
      // A failed check means signed out. There is nothing for a viewer to act on,
      // and the site works either way.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AccountContext.Provider value={{ account, ready }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  return useContext(AccountContext);
}
