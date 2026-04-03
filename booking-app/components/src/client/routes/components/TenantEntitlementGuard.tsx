"use client";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import { TENANTS, TenantValue } from "@/components/src/constants/tenants";
import { Box, CircularProgress } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

/** Normalize mediaCommons → mc so comparisons use a single canonical value. */
const canonicalize = (tenant: string): TenantValue =>
  tenant === TENANTS.MEDIA_COMMONS ? TENANTS.MC : (tenant as TenantValue);

const FALLBACK_TENANTS: TenantValue[] = [TENANTS.MC];

/**
 * Checks whether the authenticated user is entitled to access the current
 * tenant. Redirects to the root URL if they are not.
 *
 * Wraps its children and renders a loading spinner while the check is in
 * flight. On API failure the guard fails open (allows access) to avoid
 * blocking users due to a transient error.
 */
const TenantEntitlementGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading: authLoading, isOnTestEnv } = useAuth();
  const params = useParams();
  const router = useRouter();

  // null  → check not yet complete
  // true  → entitled; render children
  // false → not entitled; redirect in progress
  const [entitled, setEntitled] = useState<boolean | null>(null);

  const tenant =
    typeof params?.tenant === "string" ? params.tenant : null;
  const netId = user?.email?.split("@")[0];

  useEffect(() => {
    if (authLoading) return;

    // AuthProvider handles unauthenticated users; skip the entitlement check
    // until we have a verified user.
    if (!user || !netId || !tenant) return;

    // Test environments bypass entitlement enforcement.
    if (isOnTestEnv) {
      setEntitled(true);
      return;
    }

    let cancelled = false;

    const checkEntitlement = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/nyu/entitlements/${netId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (cancelled) return;

        const canonicalTenant = canonicalize(tenant);

        if (response.ok) {
          const data = await response.json();
          const entitledTenants: TenantValue[] = (
            data.entitledTenants ?? FALLBACK_TENANTS
          ).map(canonicalize);

          if (entitledTenants.includes(canonicalTenant)) {
            setEntitled(true);
          } else {
            setEntitled(false);
            router.replace("/");
          }
        } else {
          // Fail open on non-OK responses to avoid blocking users unexpectedly.
          console.warn(
            `TenantEntitlementGuard: entitlements API returned ${response.status} — allowing access`
          );
          setEntitled(true);
        }
      } catch (err) {
        // Fail open on network/parse errors.
        console.warn(
          "TenantEntitlementGuard: failed to fetch entitlements — allowing access",
          err
        );
        if (!cancelled) setEntitled(true);
      }
    };

    checkEntitlement();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, netId, tenant, isOnTestEnv, router]);

  if (authLoading || entitled === null) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // entitled === false means the redirect is already in flight; render nothing.
  if (!entitled) return null;

  return <>{children}</>;
};

export default TenantEntitlementGuard;
