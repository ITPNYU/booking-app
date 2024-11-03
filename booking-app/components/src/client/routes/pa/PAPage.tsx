import { Box, Tab, Tabs } from "@mui/material";
import { PageContextLevel, PagePermission } from "../../../types";
import React, { useContext, useMemo, useState } from "react";

import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { DatabaseContext } from "../components/Provider";
import { useAuth } from "../components/AuthProvider";

const PAPage = () => {
  const { paUsers, pagePermission } = useContext(DatabaseContext);
  const { userEmail } = useAuth();
  const [tab, setTab] = useState("bookings");

  const paEmails = useMemo<string[]>(
    () => paUsers.map((user) => user.email),
    [paUsers]
  );

  const userHasPermission =
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.PA;

  if (paEmails.length === 0 || userEmail === null) {
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
          </Tabs>
          {tab === "bookings" && <Bookings pageContext={PageContextLevel.PA} />}
        </div>
      )}
    </Box>
  );
};

export default PAPage;
