import { Box, Tab, Tabs } from "@mui/material";
import { PageContextLevel, PagePermission } from "../../../types";
import { useMemo, useState } from "react";

import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { Tenants } from "@/components/src/policy";
import { useAuth } from "../../providers/AuthProvider";
import { useSharedDatabase } from "../../providers/SharedDatabaseProvider";

const Liaison = ({ calendarEventId }) => {
  const { approverUsers, pagePermission } = useSharedDatabase();
  const { userEmail } = useAuth();

  const [tab, setTab] = useState("bookings");

  const approverEmails = useMemo<string[]>(
    () => approverUsers.map((user) => user.email),
    [approverUsers]
  );

  const userHasPermission =
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON;

  if (approverEmails.length === 0 || userEmail === null) {
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
          {tab === "bookings" && (
            <Bookings
              calendarEventId={calendarEventId}
              pageContext={PageContextLevel.LIAISON}
              tenant={Tenants.MEDIA_COMMONS}
            />
          )}
        </div>
      )}
    </Box>
  );
};

export default Liaison;
