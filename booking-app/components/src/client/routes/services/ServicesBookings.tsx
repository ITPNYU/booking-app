import React, { useContext, useMemo } from "react";
import { PageContextLevel } from "../../../types";
import { XStateUtils } from "../../../utils/xstateUnified";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const ServicesBookings: React.FC = () => {
  const { allBookings } = useContext(DatabaseContext);

  // Filter bookings to show only those with XState value "Service Requested"
  const servicesRequestedBookings = useMemo(() => {
    if (!allBookings || allBookings.length === 0) {
      return [];
    }

    // Use the unified XState utility to filter services request bookings
    const filtered = XStateUtils.getServicesRequestBookings(allBookings);

    // Debug logging for each filtered booking
    filtered.forEach((booking) => {
      XStateUtils.debugXState(booking, "SERVICES FILTER DEBUG");
    });

    return filtered;
  }, [allBookings]);

  console.log(
    `📋 SERVICES BOOKINGS: Found ${servicesRequestedBookings.length} bookings with "Service Requested" state`
  );

  // Create a custom context that only shows Service Requested bookings
  const customContext = {
    ...useContext(DatabaseContext),
    allBookings: servicesRequestedBookings,
  };

  return (
    <DatabaseContext.Provider value={customContext}>
      <Bookings pageContext={PageContextLevel.SERVICES} />
    </DatabaseContext.Provider>
  );
};

export default ServicesBookings;
