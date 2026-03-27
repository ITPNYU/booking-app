"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import React from "react";

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
