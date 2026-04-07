"use client";

import { Box } from "@mui/material";
import { useContext, useMemo, useState } from "react";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { DatabaseContext } from "../components/Provider";
import { PagePermission } from "../../../types";
import SuperAdminSettings from "./settings";
import SchemaEditor from "./schemaEditor";
import SchemaCompare from "./schemaCompare";
import NyuIdentityLookup from "./nyuIdentityLookup";
import { CenterLoading } from "../components/Loading";

export default function SuperAdmin() {
  const [tab, setTab] = useState("settings");
  const { pagePermission, userEmail, superAdminUsers } =
    useContext(DatabaseContext);

  const superAdminEmails = useMemo<string[]>(
    () => superAdminUsers.map((user) => user.email),
    [superAdminUsers],
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
            <Tab value="schema" label="Schema Editor" />
            <Tab value="compare" label="Schema Diff (Dev/Stg/Prod)" />
            <Tab value="identity" label="NYU Identity Lookup" />
          </Tabs>
          {tab === "settings" && <SuperAdminSettings />}
          {tab === "schema" && <SchemaEditor />}
          {tab === "compare" && <SchemaCompare />}
          {tab === "identity" && <NyuIdentityLookup />}
        </div>
      )}
    </Box>
  );
}
