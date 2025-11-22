import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useState } from "react";
import { PagePermission } from "../../../types";

import { hasAnyPermission } from "@/components/src/utils/permissions";
import { DatabaseContext } from "../components/Provider";
import ServicesBookings from "./ServicesBookings";

const Services = () => {
  const { pagePermission } = useContext(DatabaseContext);

  const [tab, setTab] = useState("bookings");

  const userHasPermission = hasAnyPermission(pagePermission, [
    PagePermission.ADMIN,
    PagePermission.SERVICES,
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
            <Tab value="bookings" label="Service Requests" />
          </Tabs>
          {tab === "bookings" && <ServicesBookings />}
        </div>
      )}
    </Box>
  );
};

export default Services;
