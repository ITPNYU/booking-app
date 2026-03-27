"use client";

import { useSession, signIn } from "next-auth/react";
import { useParams, usePathname, useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isTestEnvironment } from "@/lib/utils/testEnvironment";

export type AppUser = {
  email: string | null;
  netId?: string;
  name?: string | null;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  isOnTestEnv: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isOnTestEnv: false,
});

export const useAuth = () => useContext(AuthContext);

// Cache isTestEnv result at module level — it never changes during a session
let cachedTestEnvStatus: boolean | null = null;

async function fetchTestEnvStatus(): Promise<boolean> {
  if (cachedTestEnvStatus !== null) return cachedTestEnvStatus;

  // Check synchronous env var first
  if (isTestEnvironment()) {
    cachedTestEnvStatus = true;
    return true;
  }

  try {
    const res = await fetch(`${window.location.origin}/api/isTestEnv`);
    if (res.ok) {
      const { isOnTestEnv } = await res.json();
      cachedTestEnvStatus = isOnTestEnv;
      return isOnTestEnv;
    }
  } catch {
    // ignore
  }
  cachedTestEnvStatus = false;
  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnTestEnv, setIsOnTestEnv] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  useEffect(() => {
    const handleAuth = async () => {
      const testEnvStatus = await fetchTestEnvStatus();
      setIsOnTestEnv(testEnvStatus);

      // In test environment, create a mock user to bypass authentication
      if (testEnvStatus) {
        setUser({
          email: "test@nyu.edu",
          netId: "test",
          name: "Test User",
        });
        setLoading(false);
        return;
      }

      if (status === "loading") return;

      if (status === "authenticated" && session?.user) {
        setUser({
          email: session.user.email ?? null,
          netId:
            (session.user as Record<string, unknown>).netId as
              | string
              | undefined,
          name: session.user.name,
        });
        setLoading(false);
      } else if (status === "unauthenticated") {
        setUser(null);
        setLoading(false);

        // Redirect to sign-in if not already there
        if (!pathname.includes("signin")) {
          const signinPath = params?.tenant
            ? `/${params.tenant}/signin`
            : "/signin";
          router.push(signinPath);
        }
      }
    };

    handleAuth();
  }, [session, status, router, params, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, error, isOnTestEnv }}>
      {children}
    </AuthContext.Provider>
  );
};
