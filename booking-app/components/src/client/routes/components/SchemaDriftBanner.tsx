"use client";

import { Alert, Box, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";
import { computeDiffSummary } from "@/lib/utils/schemaDiff";
import { PagePermission } from "../../../types";
import { DatabaseContext } from "./Provider";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes

export default function SchemaDriftBanner() {
  const { pagePermission, userEmail } = useContext(DatabaseContext);
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const [changedCount, setChangedCount] = useState(0);
  const [checked, setChecked] = useState(false);

  const checkDrift = useCallback(async () => {
    if (!userEmail || !tenant) return;

    try {
      const res = await fetch(`/api/tenantSchema/${tenant}/compare`, {
        headers: { "x-user-email": userEmail },
      });
      if (!res.ok) {
        setChangedCount(0);
        return;
      }

      const data: Record<string, Record<string, unknown> | null> =
        await res.json();

      const dev = data.development;
      const prod = data.production;

      if (!dev || !prod) {
        setChangedCount(0);
        setChecked(true);
        return;
      }

      const diff = computeDiffSummary(dev, prod);
      setChangedCount(diff.added.length + diff.removed.length + diff.changed.length);
    } catch {
      setChangedCount(0);
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

  if (pagePermission !== PagePermission.SUPER_ADMIN || !checked || changedCount === 0) {
    return null;
  }

  const handleNavigate = () => router.push(`/${tenant}/super?tab=compare`);

  return (
    <Box
      sx={{ cursor: "pointer" }}
      role="link"
      tabIndex={0}
      aria-label={`Review schema drift details for tenant ${tenant}`}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleNavigate();
        }
      }}
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
          <strong>Schema drift detected:</strong> {changedCount} field
          {changedCount !== 1 ? "s" : ""} differ between Development and
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
