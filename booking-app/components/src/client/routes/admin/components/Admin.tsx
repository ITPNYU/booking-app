import { PageContextLevel, PagePermission } from "../../../../types";
import React, { useContext, useMemo, useState } from "react";

import { Bookings } from "../../components/bookingTable/Bookings";
import { Box } from "@mui/material";
import { CenterLoading } from "../../components/Loading";
import { DatabaseContext } from "../../components/Provider";
import Settings from "./Settings";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

export default function Admin() {
  const [tab, setTab] = useState("bookings");
  const { adminUsers, pagePermission, userEmail } = useContext(DatabaseContext);

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
            <Bookings pageContext={PageContextLevel.ADMIN} />
          )}
          {tab === "settings" && <Settings />}
        </div>
      )}
    </Box>
  );
}
