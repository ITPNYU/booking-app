import { Box, Tab, Tabs } from "@mui/material";
import { PageContextLevel, PagePermission } from "../../../types";
import { useMemo, useState } from "react";

import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { Tenants } from "@/components/src/policy";
import { useAuth } from "../../providers/AuthProvider";
import { useMediaCommonsDatabase } from "../../providers/MediaCommonsDatabaseProvider";
import { useSharedDatabase } from "../../providers/SharedDatabaseProvider";

const PAPage = () => {
  const { pagePermission } = useSharedDatabase();
  const { paUsers } = useMediaCommonsDatabase();
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
          {tab === "bookings" && (
            <Bookings
              pageContext={PageContextLevel.PA}
              tenant={Tenants.MEDIA_COMMONS}
            />
          )}
        </div>
      )}
    </Box>
  );
};

export default PAPage;
