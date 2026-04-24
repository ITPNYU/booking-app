"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import React from "react";

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  // `refetchOnWindowFocus: false` stops NextAuth from re-hitting
  // /api/auth/session every time the tab regains focus. The default `true`
  // gave `useSession()` a fresh `session` object, which cascaded into a
  // re-render of `AuthProvider` → `DatabaseProvider` and re-fired its
  // permission/booking fetches. Once those reads were proxied through
  // `/api/firestore/*` (PR #1431) the cascade became a visible white flash
  // on every refocus. Token expiry is still surfaced on the next API call
  // that hits the auth gate, so the only thing we lose is "another tab
  // signed me out" detection — acceptable for this app.
  <NextAuthSessionProvider refetchOnWindowFocus={false}>
    {children}
  </NextAuthSessionProvider>
);
