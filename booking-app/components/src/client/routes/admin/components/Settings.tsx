import { Divider, ListItemButton, ListItemText, Stack } from "@mui/material";

import Grid from "@mui/material/Unstable_Grid2";
import { useContext, useMemo, useState } from "react";
import { PagePermission } from "../../../../types";
import { DatabaseContext } from "../../components/Provider";
import { AdminUsers } from "./AdminUsers";
import { Approvers } from "./Approvers";
import { BannedUsers } from "./Ban";
import BookingTypes from "./BookingTypes";
import { Departments } from "./Departments";
import ExportDatabase from "./ExportDatabase";
import MaintenanceModeSettings from "./MaintenanceModeSettings";
import { PAUsers } from "./PAUsers";
import PolicySettings from "./PolicySettings";
import SafetyTrainedUsers from "./SafetyTraining";
import SyncCalendars from "./SyncCalendars";
import { PreBannedUsers } from "./PreBan";
import SiteBannerSettings from "./SiteBannerSettings";

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
  { label: "Maintenance mode", id: "maintenanceMode" },
  { label: "Export", id: "export" },
  { label: "Sync Calendars", id: "syncCalendars" },
  { label: "Site banner", id: "siteBanner" },
];

type SettingsProps = {
  maintenanceOnly?: boolean;
};

export default function Settings({ maintenanceOnly = false }: SettingsProps) {
  const { pagePermission } = useContext(DatabaseContext);
  const canManageMaintenanceMode = pagePermission === PagePermission.SUPER_ADMIN;
  const visibleTabs = useMemo(
    () =>
      tabs.filter(
        (currentTab) =>
          currentTab.id !== "maintenanceMode" || canManageMaintenanceMode,
      ),
    [canManageMaintenanceMode],
  );
  const [tab, setTab] = useState(
    maintenanceOnly ? "maintenanceMode" : "safetyTraining",
  );

  if (maintenanceOnly) {
    return canManageMaintenanceMode ? (
      <MaintenanceModeSettings />
    ) : (
      <div>You do not have permission to view this page.</div>
    );
  }

  return (
    <Grid container marginTop={4} spacing={2}>
      <Grid xs={2}>
        <Stack
          divider={<Divider sx={{ borderColor: "#21212114" }} />}
          sx={{ border: "1px solid #21212114", borderRadius: "4px" }}
        >
          {visibleTabs.map((currentTab) => (
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
        {tab === "maintenanceMode" && canManageMaintenanceMode && (
          <MaintenanceModeSettings />
        )}
        {tab === "export" && <ExportDatabase />}
        {tab === "syncCalendars" && <SyncCalendars />}
        {tab === "siteBanner" && <SiteBannerSettings />}
      </Grid>
    </Grid>
  );
}
