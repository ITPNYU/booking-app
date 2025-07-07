"use client";

import { Box } from "@mui/material";
import { useContext, useMemo, useState } from "react";
import { DatabaseContext } from "../components/Provider";
import { PagePermission } from "../../../types";
import SuperAdminSettings from "./settings";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { CenterLoading } from "../components/Loading";

export default function SuperAdmin() {
  const [tab, setTab] = useState("settings");
  const { pagePermission, userEmail, superAdminUsers } =
    useContext(DatabaseContext);

  const superAdminEmails = useMemo<string[]>(
    () => superAdminUsers.map((user) => user.email),
    [superAdminUsers]
  );

  const userHasPermission = pagePermission === PagePermission.SUPER_ADMIN;

  if (superAdminEmails.length === 0 || userEmail == null) {
    return <CenterLoading />;
  }

  return (
    <Box margin={3}>
      {!userHasPermission ? (
        <div>You do not have permission to view this page.</div>
      ) : (
        <div>
          <Tabs
            value={tab}
            onChange={(_, newVal) => setTab(newVal)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab value="settings" label="Settings" />
          </Tabs>
          {tab === "settings" && <SuperAdminSettings />}
        </div>
      )}
    </Box>
  );
}
