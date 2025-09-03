import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useState } from "react";
import { PageContextLevel, PagePermission } from "../../../types";

import { hasAnyPermissionMultiple } from "@/components/src/utils/permissions";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const Staffing = () => {
  const { userPermissions } = useContext(DatabaseContext);

  const [tab, setTab] = useState("bookings");

  const userHasPermission = hasAnyPermissionMultiple(userPermissions, [
    PagePermission.ADMIN,
    PagePermission.STAFFING,
    PagePermission.SUPER_ADMIN,
  ]);

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
            <Bookings pageContext={PageContextLevel.STAFFING} />
          )}
        </div>
      )}
    </Box>
  );
};

export default Staffing;
