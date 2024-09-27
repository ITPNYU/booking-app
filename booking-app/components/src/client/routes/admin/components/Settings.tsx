import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";
import React, { useState } from "react";

import { AdminUsers } from "./AdminUsers";
import { BannedUsers } from "./Ban";
import BookingTypes from "./BookingTypes";
import { Departments } from "./Departments";
import ExportDatabase from "./ExportDatabase";
import FinalApproverSetting from "./PolicySettings";
import Grid from "@mui/material/Unstable_Grid2";
import { Liaisons } from "./Liaisons";
import { PAUsers } from "./PAUsers";
import SafetyTrainedUsers from "./SafetyTraining";
import SyncCalendars from "./SyncCalendars";

const tabs = [
  { label: "Safety Training", id: "safetyTraining" },
  { label: "PA Users", id: "pa" },
  { label: "Admin Users", id: "admin" },
  { label: "Liaisons", id: "liaisons" },
  { label: "Departments", id: "departments" },
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
          {tabs.map((tab) => (
            <div key={tab.label}>
              <ListItemButton onClick={() => setTab(tab.id)}>
                <ListItemText primary={tab.label} />
              </ListItemButton>
            </div>
          ))}
        </Stack>
      </Grid>
      <Grid xs={10}>
        {tab === "safetyTraining" && <SafetyTrainedUsers />}
        {tab === "pa" && <PAUsers />}
        {tab === "admin" && <AdminUsers />}
        {tab === "liaisons" && <Liaisons />}
        {tab === "ban" && <BannedUsers />}
        {tab === "departments" && <Departments />}
        {tab === "bookingTypes" && <BookingTypes />}
        {tab === "policy" && <FinalApproverSetting />}
        {tab === "export" && <ExportDatabase />}
        {tab === "syncCalendars" && <SyncCalendars />}
      </Grid>
    </Grid>
  );
}
