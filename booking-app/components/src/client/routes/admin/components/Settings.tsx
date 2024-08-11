import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";
import React, { useState } from "react";

import { AdminUsers } from "./AdminUsers";
import { BannedUsers } from "./Ban";
import Grid from "@mui/material/Unstable_Grid2";
import { Liaisons } from "./Liaisons";
import { PAUsers } from "./PAUsers";
import ReservationTypes from "./ReservationTypes";
import SafetyTrainedUsers from "./SafetyTraining";
import { Departments } from "./Departments";

const tabs = [
  { label: "Safety Training", id: "safetyTraining" },
  { label: "PA Users", id: "pa" },
  { label: "Admin Users", id: "admin" },
  { label: "Liaisons", id: "liaisons" },
  { label: "Departments", id: "departments" },
  { label: "Ban", id: "ban" },
  { label: "Reservation Types", id: "reservationTypes" },
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
        {tab === "departments" && <Departments />}
        {tab === "ban" && <BannedUsers />}
        {tab === "reservationTypes" && <ReservationTypes />}
      </Grid>
    </Grid>
  );
}
