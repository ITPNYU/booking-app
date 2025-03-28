import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";

import Grid from "@mui/material/Unstable_Grid2";
import { useState } from "react";
import { AdminUsers } from "./AdminUsers";
import { Approvers } from "./Approvers";
import { BannedUsers } from "./Ban";
import BookingTypes from "./BookingTypes";
import { Departments } from "./Departments";
import ExportDatabase from "./ExportDatabase";
import { PAUsers } from "./PAUsers";
import PolicySettings from "./PolicySettings";
import SafetyTrainedUsers from "./SafetyTraining";
import SyncCalendars from "./SyncCalendars";
import { PreBannedUsers } from "./PreBan";

const tabs = [
  { label: "Safety Training", id: "safetyTraining" },
  { label: "PA Users", id: "pa" },
  { label: "Admin Users", id: "admin" },
  { label: "Approvers", id: "approvers" },
  { label: "Departments", id: "departments" },
  { label: "Pre-ban", id: "preBan" },
  { label: "Ban", id: "ban" },
  { label: "Booking Types", id: "bookingTypes" },
  { label: "Policy Settings", id: "policy" },
  { label: "Export", id: "export" },
  { label: "Sync Calendars", id: "syncCalendars" },
];

export default function Settings() {
  const [tab, setTab] = useState("safetyTraining");
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
      <Grid xs={10}>
        {tab === "safetyTraining" && <SafetyTrainedUsers />}
        {tab === "preBan" && <PreBannedUsers />}
        {tab === "pa" && <PAUsers />}
        {tab === "admin" && <AdminUsers />}
        {tab === "approvers" && <Approvers />}
        {tab === "ban" && <BannedUsers />}
        {tab === "departments" && <Departments />}
        {tab === "bookingTypes" && <BookingTypes />}
        {tab === "policy" && <PolicySettings />}
        {tab === "export" && <ExportDatabase />}
        {tab === "syncCalendars" && <SyncCalendars />}
      </Grid>
    </Grid>
  );
}
