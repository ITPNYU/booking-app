"use client";

import { Alert, Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useContext } from "react";
import { DEFAULT_SITE_BANNER_COLOR_HEX } from "@/lib/utils/siteBannerHex";
import { DatabaseContext } from "./Provider";

export default function TenantSiteBanner() {
  const { siteBanner, permissionsLoading } = useContext(DatabaseContext);

  if (permissionsLoading) {
    return null;
  }

  if (!siteBanner.enabled || !siteBanner.message.trim()) {
    return null;
  }

  const accent = siteBanner.colorHex || DEFAULT_SITE_BANNER_COLOR_HEX;
  const tintBg = alpha(accent, 0.12);

  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Alert
        severity="info"
        sx={{
          alignItems: "flex-start",
          bgcolor: tintBg,
          color: accent,
          border: `1px solid ${alpha(accent, 0.22)}`,
          "& .MuiAlert-icon": {
            color: accent,
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
