"use client";

import { signIn } from "next-auth/react";
import { Box, styled } from "@mui/material";
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
  const params = useParams();
  const { isOnTestEnv } = useAuth();
  const searchParams = useSearchParams();

  const tenant = Array.isArray(params?.tenant)
    ? params.tenant[0]
    : params?.tenant;

  useEffect(() => {
    if (isOnTestEnv) return;
    const callbackUrl = tenant ? `/${tenant}` : "/";
    signIn("nyu-sso", { callbackUrl });
  }, [isOnTestEnv, tenant]);

  return (
    <div>
      <Center>
        {isOnTestEnv ? (
          <AutoRedirectMessage
            tenant={tenant}
            searchParams={searchParams}
          />
        ) : (
          <p style={{ marginTop: 48 }}>Redirecting to NYU sign-in…</p>
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
