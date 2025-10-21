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
      console.log("handleAuth triggered");
      let testEnvStatus = false;
      try {
        const testEnvRes = await fetch(
          window.location.origin + "/api/isTestEnv"
        );
        if (testEnvRes.ok) {
          const { isOnTestEnv } = await testEnvRes.json();
          testEnvStatus = isOnTestEnv;
          setIsOnTestEnv(isOnTestEnv);
        } else {
          console.warn("Failed to fetch test env status:", testEnvRes.status);
          setIsOnTestEnv(false);
        }
      } catch (error) {
        console.warn("Error fetching test env status:", error);
        setIsOnTestEnv(false);
      }

      const user = auth.currentUser;
      console.log("auth.currentUser:", user);

      if (user) {
        console.log("User object exists:", user.email);
        if (user.email?.endsWith("@nyu.edu") || testEnvStatus) {
          console.log("Setting user state:", user.email);
          setUser(user);
        } else {
          console.log("Invalid email, signing out:", user.email);
          await auth.signOut();
          setUser(null);
          setError("Only nyu.edu email addresses are allowed.");
        }
      } else {
        console.log("No user object found. Checking if sign-in needed.");
        
        // In test environment, create a mock user to bypass authentication
        if (testEnvStatus) {
          console.log("Test environment detected, creating mock user");
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
              console.log("Attempting signInWithGoogle...");
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
