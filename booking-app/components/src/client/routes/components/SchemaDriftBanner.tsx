"use client";

import { Alert, Box, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";
import { PagePermission } from "../../../types";
import { DatabaseContext } from "./Provider";

type TenantDrift = {
  tenant: string;
  changedCount: number;
};

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes

export default function SchemaDriftBanner() {
  const { pagePermission, userEmail } = useContext(DatabaseContext);
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [drifts, setDrifts] = useState<TenantDrift[]>([]);
  const [checked, setChecked] = useState(false);

  const checkDrift = useCallback(async () => {
    if (!userEmail || !tenant) return;

    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/compare`, {
        headers: { "x-user-email": userEmail },
      });
      if (!res.ok) return;

      const data: Record<string, Record<string, unknown> | null> =
        await res.json();

      const dev = data.development;
      const prod = data.production;

      if (!dev || !prod) {
        setDrifts([]);
        setChecked(true);
        return;
      }

      const allKeys = new Set([...Object.keys(dev), ...Object.keys(prod)]);
      let changedCount = 0;
      for (const key of allKeys) {
        const inDev = key in dev;
        const inProd = key in prod;
        if (inDev !== inProd) {
          changedCount++;
        } else if (JSON.stringify(dev[key]) !== JSON.stringify(prod[key])) {
          changedCount++;
        }
      }

      if (changedCount > 0) {
        setDrifts([{ tenant, changedCount }]);
      } else {
        setDrifts([]);
      }
    } catch {
      // Silently fail — banner just won't show
    } finally {
      setChecked(true);
    }
  }, [userEmail, tenant]);

  useEffect(() => {
    if (pagePermission !== PagePermission.SUPER_ADMIN) return;

    checkDrift();
    const id = setInterval(checkDrift, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pagePermission, checkDrift]);

  if (pagePermission !== PagePermission.SUPER_ADMIN || !checked || drifts.length === 0) {
    return null;
  }

  const totalChanges = drifts.reduce((sum, d) => sum + d.changedCount, 0);

  return (
    <Box
      sx={{ cursor: "pointer" }}
      onClick={() => router.push(`/${tenant}/super`)}
    >
      <Alert
        severity="warning"
        sx={{
          borderRadius: 0,
          py: 0,
          "& .MuiAlert-message": { width: "100%" },
        }}
      >
        <Typography variant="body2">
          <strong>Schema drift detected:</strong> {totalChanges} field
          {totalChanges !== 1 ? "s" : ""} differ between Development and
          Production for tenant &quot;{tenant}&quot;.{" "}
          <Typography
            component="span"
            variant="body2"
            sx={{ textDecoration: "underline" }}
          >
            Review in Schema Diff
          </Typography>
        </Typography>
      </Alert>
    </Box>
  );
}
