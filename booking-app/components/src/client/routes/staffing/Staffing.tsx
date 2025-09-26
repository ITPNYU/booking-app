import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useState } from "react";
import { PagePermission } from "../../../types";

import { hasAnyPermission } from "@/components/src/utils/permissions";
import { DatabaseContext } from "../components/Provider";
import StaffingBookings from "./StaffingBookings";

const Staffing = () => {
  const { pagePermission } = useContext(DatabaseContext);

  const [tab, setTab] = useState("bookings");

  const userHasPermission = hasAnyPermission(pagePermission, [
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
            <Tab value="bookings" label="Staffing Requests" />
          </Tabs>
          {tab === "bookings" && <StaffingBookings />}
        </div>
      )}
    </Box>
  );
};

export default Staffing;
