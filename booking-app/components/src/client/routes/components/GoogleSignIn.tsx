"use client";
import {
  getGoogleRedirectResult,
  signInWithGoogle,
} from "@/lib/firebase/firebaseClient";
import { Box, Button, styled } from "@mui/material";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const GoogleSignIn = () => {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const { isOnTestEnv } = useAuth();
  const searchParams = useSearchParams();

  // Check if running on localhost
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  // Check for redirect result when component mounts (only for non-localhost environments)
  useEffect(() => {
    if (!isLocalhost) {
      const handleRedirectResult = async () => {
        try {
          const user = await getGoogleRedirectResult();
          if (user) {
            console.log("Google sign-in successful", user);
            // Redirect to the appropriate tenant home page or root
            const redirectPath = params?.tenant ? `/${params.tenant}` : "/";
            router.push(redirectPath);
          }
        } catch (error: any) {
          setError(error.message || "Google sign-in failed. Please try again.");
          console.error("Google sign-in error", error);
        }
      };

      handleRedirectResult();
    }
  }, [router, params, isLocalhost]);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      const user = await signInWithGoogle();

      if (isLocalhost && user) {
        // For localhost popup signin, handle success immediately
        console.log("Google sign-in successful", user);
        const redirectPath = params?.tenant ? `/${params.tenant}` : "/";
        router.push(redirectPath);
      }
      // For non-localhost redirect signin, the redirect will happen automatically
    } catch (error: any) {
      setError(error.message || "Google sign-in failed. Please try again.");
      console.error("Google sign-in error", error);
    }
  };

  return (
    <div>
      <Center>
        {isOnTestEnv ? (
          <AutoRedirectMessage
            tenant={
              Array.isArray(params?.tenant) ? params.tenant[0] : params?.tenant
            }
            searchParams={searchParams}
          />
        ) : (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={handleGoogleSignIn}
              sx={{
                alignSelf: "center",
                marginTop: 6,
              }}
            >
              Sign in with NYU Google Account
            </Button>
            <p>
              {isLocalhost
                ? "A popup window will open for NYU SSO login."
                : "You'll be redirected to the NYU SSO login page to sign in securely."}
            </p>
          </>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </Center>
    </div>
  );
};

export default GoogleSignIn;

const AutoRedirectMessage: React.FC<{
  tenant?: string;
  searchParams: ReturnType<typeof useSearchParams>;
}> = ({ tenant, searchParams }) => {
  const router = useRouter();

  useEffect(() => {
    const redirectTarget =
      searchParams?.get("redirect") ?? (tenant ? `/${tenant}` : "/");
    const timeoutId = setTimeout(() => {
      router.replace(redirectTarget);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [router, searchParams, tenant]);

  return (
    <div>
      <p>Test environment detected - authentication bypassed</p>
      <p>Mock user automatically created: test@nyu.edu</p>
    </div>
  );
};
