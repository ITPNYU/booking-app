"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth, signInWithGoogle } from "@/lib/firebase/firebaseClient";
import { usePathname, useRouter } from "next/navigation";

import { User } from "firebase/auth";
import { UserApiData } from "../../types";

type AuthContextType = {
  user: User | null;
  userEmail: string | null;
  netId: string | null;
  setUser: (x: User | null) => void;
  loading: boolean;
  error: string | null;
  userApiData?: UserApiData;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userEmail: null,
  netId: null,
  setUser: (x: User | null) => {},
  loading: true,
  error: null,
  userApiData: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userApiData, setUserApiData] = useState<UserApiData | undefined>(
    undefined
  );

  const router = useRouter();
  const pathname = usePathname();

  const netId = useMemo(() => user?.email?.split("@")[0], [user]);

  useEffect(() => {
    const fetchUserApiData = async () => {
      if (!netId) return;
      try {
        const response = await fetch(`/api/nyu/identity/${netId}`);
        if (response.ok) {
          const data = await response.json();
          setUserApiData(data);
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };
    fetchUserApiData();
  }, [netId]);

  useEffect(() => {
    const handleAuth = async () => {
      const user = auth.currentUser;
      if (user) {
        if (user.email?.endsWith("@nyu.edu")) {
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
    <AuthContext.Provider
      value={{
        user,
        userEmail: user?.email,
        netId,
        setUser,
        loading,
        error,
        userApiData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
