"use client";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import { TenantValue } from "@/components/src/constants/tenants";
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

const TENANT_DISPLAY: Record<TenantValue, { label: string; description: string }> = {
  mc: {
    label: "Media Commons",
    description: "Book spaces and equipment at the Media Commons.",
  },
  mediaCommons: {
    label: "Media Commons",
    description: "Book spaces and equipment at the Media Commons.",
  },
  itp: {
    label: "ITP / IMA / Low Res",
    description: "Book spaces and equipment at ITP, IMA, and Low Res.",
  },
};

const HomePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [entitledTenants, setEntitledTenants] = useState<TenantValue[]>([]);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);

  const netId = user?.email?.split("@")[0];

  useEffect(() => {
    if (!netId) return;

    const fetchEntitlements = async () => {
      setLoadingEntitlements(true);
      try {
        const response = await fetch(`/api/nyu/entitlements/${netId}`);
        if (response.ok) {
          const data = await response.json();
          setEntitledTenants(data.entitledTenants ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch entitlements:", err);
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

  // Filter out mediaCommons alias — only show the canonical mc slug in the dashboard
  const displayTenants = entitledTenants.filter((t) => t !== "mediaCommons");

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Box display="flex" alignItems="center" justifyContent="center" flexWrap="wrap" gap={3}>
        {displayTenants.map((tenant) => {
          const display = TENANT_DISPLAY[tenant];
          if (!display) return null;
          return (
            <Card key={tenant} sx={{ flex: "1 1 280px", maxWidth: 360 }}>
              <CardActionArea href={`/${tenant}`} sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={500} gutterBottom>
                    {display.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {display.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Container>
  );
};

export default HomePage;
