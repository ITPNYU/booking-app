"use client";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import { TENANTS } from "@/components/src/constants/tenants";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";

type TenantCard = {
  id: string;
  label: string;
  description: string;
};

const TENANT_DISPLAY: Record<string, { label: string; description: string }> = {
  [TENANTS.MC]: {
    label: "Media Commons",
    description: "Book spaces and equipment at the Media Commons.",
  },
  [TENANTS.ITP]: {
    label: "ITP / IMA / Low Res",
    description: "Book spaces and equipment at ITP, IMA, and Low Res.",
  },
};

/** Canonicalize the mediaCommons alias to mc so the display map has a single entry. */
const canonicalize = (tenant: string): string =>
  tenant === TENANTS.MEDIA_COMMONS ? TENANTS.MC : tenant;

/** Tenants shown when the entitlements API is unavailable. */
const FALLBACK_TENANTS: string[] = [TENANTS.MC];

const HomePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [entitledTenants, setEntitledTenants] = useState<string[]>([]);
  const [tenantCards, setTenantCards] = useState<TenantCard[] | null>(null);
  const [entitlementsError, setEntitlementsError] = useState(false);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);

  const netId = user?.email?.split("@")[0];

  useEffect(() => {
    if (!netId) return;

    const fetchEntitlements = async () => {
      setLoadingEntitlements(true);
      setEntitlementsError(false);
      try {
        const response = await fetch(`/api/nyu/entitlements/${netId}`);
        if (response.ok) {
          const data = await response.json();
          setEntitledTenants(data.entitledTenants ?? FALLBACK_TENANTS);
          setTenantCards(Array.isArray(data.tenantCards) ? data.tenantCards : null);
        } else {
          console.error(
            `Entitlements API returned ${response.status} — falling back to default tenants`,
          );
          setEntitledTenants(FALLBACK_TENANTS);
          setTenantCards(null);
          setEntitlementsError(true);
        }
      } catch (err) {
        console.error("Failed to fetch entitlements:", err);
        setEntitledTenants(FALLBACK_TENANTS);
        setTenantCards(null);
        setEntitlementsError(true);
      } finally {
        setLoadingEntitlements(false);
      }
    };

    fetchEntitlements();
  }, [netId]);

  const isLoading = authLoading || (!!user && loadingEntitlements);

  if (isLoading) {
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

  // AuthProvider handles the unauthenticated redirect; render nothing while it does so
  if (!user) return null;

  // Canonicalize aliases (mediaCommons → mc) and deduplicate
  const displayTenants = [...new Set(entitledTenants.map(canonicalize))];
  const displayCards: TenantCard[] =
    tenantCards ??
    displayTenants.flatMap((tenant) => {
      const display = TENANT_DISPLAY[tenant];
      return display
        ? [{ id: tenant, label: display.label, description: display.description }]
        : [];
    });

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      {entitlementsError && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, textAlign: "center" }}
        >
          Could not load your full access list. Showing available facilities.
        </Typography>
      )}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        gap={3}
      >
        {displayCards.map((card) => (
            <Card key={card.id} sx={{ flex: "1 1 280px", maxWidth: 360 }}>
              <CardActionArea href={`/${card.id}`} sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={500} gutterBottom>
                    {card.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
      </Box>
    </Container>
  );
};

export default HomePage;
