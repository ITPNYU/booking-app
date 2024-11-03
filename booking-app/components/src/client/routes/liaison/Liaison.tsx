import { Box, Tab, Tabs } from "@mui/material";
import { PageContextLevel, PagePermission } from "../../../types";
import { useMemo, useState } from "react";

import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { useAuth } from "../../providers/AuthProvider";
import { useSharedDatabase } from "../../providers/SharedDatabaseProvider";

const Liaison = ({ calendarEventId }) => {
  const { liaisonUsers, pagePermission } = useSharedDatabase();
  const { userEmail } = useAuth();

  const [tab, setTab] = useState("bookings");

  const liaisonEmails = useMemo<string[]>(
    () => liaisonUsers.map((user) => user.email),
    [liaisonUsers]
  );

  const userHasPermission =
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON;

  if (liaisonEmails.length === 0 || userEmail === null) {
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
            />
          )}
        </div>
      )}
    </Box>
  );
};

export default Liaison;
