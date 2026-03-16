"use client";

import { auth, signInWithGoogle } from "@/lib/firebase/firebaseClient";
import { User } from "firebase/auth";
import { useParams, usePathname, useRouter } from "next/navigation";
import React, { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
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

      const user = auth.currentUser;

      if (user) {
        if (user.email?.endsWith("@nyu.edu") || testEnvStatus) {
          setUser(user);
        } else {
          await auth.signOut();
          setUser(null);
          setError("Only nyu.edu email addresses are allowed.");
        }
      } else {
        // In test environment, create a mock user to bypass authentication
        if (testEnvStatus) {
          const mockUser = {
            uid: "test-user-id",
            email: "test@nyu.edu",
            displayName: "Test User",
            photoURL: null,
            emailVerified: true,
          } as User;
          setUser(mockUser);
          setLoading(false);
          return;
        }

        // Only attempt sign-in if NOT in test environment
        if (!testEnvStatus) {
          try {
            if (!pathname.includes("signin")) {
              await signInWithGoogle();
            }
          } catch (error) {
            console.error("Error during signInWithGoogle attempt:", error);
            // Redirect to appropriate signin page based on tenant
            const signinPath = params?.tenant
              ? `/${params.tenant}/signin`
              : "/signin";
            router.push(signinPath);
          }
        }
      }
      setLoading(false);
    };

    const unsubscribe = auth.onAuthStateChanged(handleAuth);

    return () => unsubscribe();
  }, [router, params, pathname]);

  useEffect(() => {
    if (error === "Only nyu.edu email addresses are allowed.") {
      // Redirect to appropriate signin page based on tenant
      const signinPath = params?.tenant
        ? `/${params.tenant}/signin`
        : "/signin";
      router.push(signinPath);
    }
  }, [error, router, params]);

  return (
    <AuthContext.Provider value={{ user, loading, error, isOnTestEnv }}>
      {children}
    </AuthContext.Provider>
  );
};
