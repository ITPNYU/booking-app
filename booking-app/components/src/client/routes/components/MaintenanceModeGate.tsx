"use client";

import { Alert, Box, Typography } from "@mui/material";
import { usePathname } from "next/navigation";
import { ReactNode, useContext } from "react";

import Loading from "./Loading";
import { DatabaseContext } from "./Provider";

type MaintenanceModeGateProps = {
  children: ReactNode;
};

export default function MaintenanceModeGate({
  children,
}: MaintenanceModeGateProps) {
  const { adminUsers, maintenanceMode, permissionsLoading, userEmail } =
    useContext(DatabaseContext);
  const pathname = usePathname();

  if (permissionsLoading) {
    return <Loading />;
  }

  if (!maintenanceMode.enabled) {
    return <>{children}</>;
  }

  const isDatabaseAdmin =
    !!userEmail && adminUsers.some((admin) => admin.email === userEmail);
  const isAdminPath = /^\/[^/]+\/admin(?:\/|$)/.test(pathname ?? "");

  if (isDatabaseAdmin && isAdminPath) {
    return <>{children}</>;
  }

  return (
    <Box
      component="main"
      sx={{
        alignItems: "center",
        display: "flex",
        minHeight: "100vh",
        px: 3,
        py: 6,
        width: "100%",
      }}
    >
      <Box sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Maintenance mode
        </Typography>
        <Alert severity="warning" sx={{ width: "100%" }}>
          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {maintenanceMode.message}
          </Typography>
        </Alert>
      </Box>
    </Box>
  );
}
