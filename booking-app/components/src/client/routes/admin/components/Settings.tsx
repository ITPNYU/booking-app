import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";
import { useMemo, useState } from "react";

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
import { Tenants } from "@/components/src/policy";

interface Props {
  tenant: Tenants;
}

export default function Settings({ tenant }: Props) {
  const [tab, setTab] = useState("safetyTraining");

  const tabs = useMemo(
    () =>
      [
        { label: "Safety Training", id: "safetyTraining" },
        { label: "PA Users", id: "pa" },
        { label: "Admin Users", id: "admin" },
        tenant === Tenants.MEDIA_COMMONS && {
          label: "Liaisons",
          id: "liaisons",
        },
        tenant === Tenants.MEDIA_COMMONS && {
          label: "Departments",
          id: "departments",
        },
        { label: "Ban", id: "ban" },
        tenant === Tenants.MEDIA_COMMONS && {
          label: "Booking Types",
          id: "bookingTypes",
        },
        { label: "Policy Settings", id: "policy" },
        { label: "Export", id: "export" },
        { label: "Sync Calendars", id: "syncCalendars" },
      ].filter((x) => x),
    [tenant]
  );

  console.log(tabs);

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
