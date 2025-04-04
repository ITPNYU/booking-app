"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth, signInWithGoogle } from "@/lib/firebase/firebaseClient";

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnTestEnv, setIsOnTestEnv] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    const handleAuth = async () => {
      const testEnvRes = await fetch(window.location.origin + "/api/isTestEnv");
      const { isOnTestEnv } = await testEnvRes.json();
      setIsOnTestEnv(isOnTestEnv);
      
      const user = auth.currentUser;
      if (user) {
        if (user.email?.endsWith("@nyu.edu") || isOnTestEnv) {
          setUser(user);
        } else {
          await auth.signOut();
          setUser(null);
          setError("Only nyu.edu email addresses are allowed.");
        }
      } else {
        try {
          if (!pathname.includes("signin")) {
            const signedInUser = await signInWithGoogle();
            setUser(signedInUser);
          }
        } catch (error) {
          router.push("/signin");
        }
      }
      setLoading(false);
    };

    const unsubscribe = auth.onAuthStateChanged(handleAuth);

    return () => unsubscribe();
  }, [router]);
  useEffect(() => {
    if (error === "Only nyu.edu email addresses are allowed.") {
      router.push("/signin");
    }
  }, [error, router]);

  return (
    <AuthContext.Provider value={{ user, loading, error, isOnTestEnv }}>
      {children}
    </AuthContext.Provider>
  );
};
