import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useState } from "react";
import { PageContextLevel, PagePermission } from "../../../types";

import { hasAnyPermission } from "@/components/src/utils/permissions";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const Equipment = () => {
  const { pagePermission } = useContext(DatabaseContext);

  const [tab, setTab] = useState("bookings");

  const userHasPermission = hasAnyPermission(pagePermission, [
    PagePermission.ADMIN,
    PagePermission.EQUIPMENT,
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
            <Bookings pageContext={PageContextLevel.EQUIPMENT} />
          )}
        </div>
      )}
    </Box>
  );
};

export default Equipment;
