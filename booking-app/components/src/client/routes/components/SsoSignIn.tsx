"use client";

import { signIn } from "next-auth/react";
import { Box, Button, styled } from "@mui/material";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

const Center = styled(Box)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const SsoSignIn = () => {
  const router = useRouter();
  const params = useParams();
  const { isOnTestEnv } = useAuth();
  const searchParams = useSearchParams();

  const handleSignIn = () => {
    const callbackUrl = params?.tenant ? `/${params.tenant}` : "/";
    signIn("nyu-sso", { callbackUrl });
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
              onClick={handleSignIn}
              sx={{
                alignSelf: "center",
                marginTop: 6,
              }}
            >
              Sign in with NYU
            </Button>
            <p>
              You'll be redirected to the NYU SSO login page to sign in
              securely.
            </p>
          </>
        )}
      </Center>
    </div>
  );
};

export default SsoSignIn;

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
