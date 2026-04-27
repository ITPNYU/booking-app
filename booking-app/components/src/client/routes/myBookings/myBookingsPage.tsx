import { Box, Tab, Tabs } from "@mui/material";
import { useContext, useState } from "react";

import { PageContextLevel } from "@/components/src/types";
import { Bookings } from "../components/bookingTable/Bookings";
import { CenterLoading } from "../components/Loading";
import { DatabaseContext } from "../components/Provider";

export default function MyBookingsPage() {
  const { userEmail } = useContext(DatabaseContext);
  const [tab, setTab] = useState("bookings");

  if (userEmail === undefined) {
    return <CenterLoading />;
  }

  return (
    <Box margin={3}>
      <Tabs
        value={tab}
        onChange={(_, newVal) => setTab(newVal)}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab value="bookings" label="Bookings" />
      </Tabs>
      {tab === "bookings" && <Bookings pageContext={PageContextLevel.USER} />}
    </Box>
  );
}
