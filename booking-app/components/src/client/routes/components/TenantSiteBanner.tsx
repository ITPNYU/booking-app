"use client";

import { Alert, Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useContext } from "react";
import { DatabaseContext } from "./Provider";

export default function TenantSiteBanner() {
  const theme = useTheme();
  const { siteBanner, permissionsLoading } = useContext(DatabaseContext);

  if (permissionsLoading) {
    return null;
  }

  if (!siteBanner.enabled || !siteBanner.message.trim()) {
    return null;
  }

  const primary = theme.palette.primary;
  const primaryTint = (primary as { main: string; 50?: string })["50"];
  const tintBg = primaryTint ?? alpha(primary.main, 0.12);

  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Alert
        severity="info"
        sx={{
          alignItems: "flex-start",
          bgcolor: tintBg,
          color: primary.main,
          border: `1px solid ${alpha(primary.main, 0.22)}`,
          "& .MuiAlert-icon": {
            color: primary.main,
            alignItems: "center",
          },
          "& .MuiAlert-message": { width: "100%", color: "inherit" },
        }}
      >
        <Typography
          component="div"
          variant="body2"
          sx={{ whiteSpace: "pre-wrap" }}
        >
          {siteBanner.message}
        </Typography>
      </Alert>
    </Box>
  );
}
