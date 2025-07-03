import { hasAnyPermission } from "@/components/src/utils/permissions";
import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useMemo, useState } from "react";
import { PageContextLevel, PagePermission } from "../../../types";

import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { DatabaseContext } from "../components/Provider";

const PAPage = () => {
  const { paUsers, pagePermission, userEmail } = useContext(DatabaseContext);
  const [tab, setTab] = useState("bookings");

  const paEmails = useMemo<string[]>(
    () => paUsers.map((user) => user.email),
    [paUsers]
  );

  const userHasPermission = hasAnyPermission(pagePermission, [
    PagePermission.ADMIN,
    PagePermission.PA,
    PagePermission.SUPER_ADMIN,
  ]);

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
