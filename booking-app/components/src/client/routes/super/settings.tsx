"use client";

import Grid from "@mui/material/Unstable_Grid2";
import { useState } from "react";
import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";
import { useContext } from "react";
import { DatabaseContext } from "../components/Provider";
import { TableNames } from "@/components/src/policy";
import EmailListTable from "../components/EmailListTable";
import { formatDate } from "../../utils/date";

function SuperAdminUsers() {
  const { superAdminUsers, reloadSuperAdminUsers } =
    useContext(DatabaseContext);

  return (
    <EmailListTable
      tableName={TableNames.SUPER_ADMINS}
      userList={superAdminUsers}
      userListRefresh={reloadSuperAdminUsers}
      columnFormatters={{ createdAt: formatDate }}
      title="Super Admin Users"
    />
  );
}

const tabs = [{ label: "Super Admin Users", id: "superAdmin" }];

export default function Settings() {
  const [tab, setTab] = useState("superAdmin");
  return (
    <Grid container marginTop={4} spacing={2}>
      <Grid xs={2}>
        <Stack
          divider={<Divider sx={{ borderColor: "#21212114" }} />}
          sx={{ border: "1px solid #21212114", borderRadius: "4px" }}
        >
          {tabs.map((currentTab) => (
            <div key={currentTab.label}>
              <ListItemButton
                onClick={() => setTab(currentTab.id)}
                selected={tab === currentTab.id}
              >
                <ListItemText primary={currentTab.label} />
              </ListItemButton>
            </div>
          ))}
        </Stack>
      </Grid>
      <Grid xs={10}>{tab === "superAdmin" && <SuperAdminUsers />}</Grid>
    </Grid>
  );
}
