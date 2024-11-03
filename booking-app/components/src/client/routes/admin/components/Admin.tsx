import { PageContextLevel, PagePermission } from "../../../../types";
import React, { useMemo, useState } from "react";

import { Bookings } from "../../components/bookingTable/Bookings";
import { Box } from "@mui/material";
import { CenterLoading } from "../../components/Loading";
import Settings from "./Settings";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useAuth } from "../../../providers/AuthProvider";
import { useMediaCommonsDatabase } from "../../../providers/MediaCommonsDatabaseProvider";
import { useSharedDatabase } from "../../../providers/SharedDatabaseProvider";

export default function Admin({ calendarEventId }) {
  const [tab, setTab] = useState("bookings");
  const { adminUsers, pagePermission } = useSharedDatabase();
  const { userEmail } = useAuth();

  const adminEmails = useMemo<string[]>(
    () => adminUsers.map((user) => user.email),
    [adminUsers]
  );
  const userHasPermission = pagePermission === PagePermission.ADMIN;

  if (adminEmails.length === 0 || userEmail == null) {
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
            <Tab value="bookings" label="Bookings" />
            <Tab value="settings" label="Settings" />
          </Tabs>
          {tab === "bookings" && (
            <Bookings
              pageContext={PageContextLevel.ADMIN}
              calendarEventId={calendarEventId}
            />
          )}
          {tab === "settings" && <Settings />}
        </div>
      )}
    </Box>
  );
}
