import React, { useContext, useMemo } from "react";
import { PageContextLevel } from "../../../types";
import {
  XStateUtils,
  createXStateChecker,
  getXStateContext,
} from "../../../utils/xstateUnified";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const ServicesBookings: React.FC = () => {
  const { allBookings } = useContext(DatabaseContext);

  const servicesRequestedBookings = useMemo(() => {
    if (!allBookings || allBookings.length === 0) return [];

    const filtered = allBookings.filter((booking) => {
      try {
        const ctx = getXStateContext(booking) || (booking as any)?.xstateData?.snapshot?.context;
        const servicesRequested = ctx?.servicesRequested;
        if (servicesRequested && typeof servicesRequested === "object") {
          if (Object.values(servicesRequested).some((v) => v === true)) return true;
        }

        // Fallback to the old checker which inspects snapshot.value / currentState
        const checker = createXStateChecker(booking as any);
        return checker.isInServicesRequest();
      } catch (err) {
        // On error, exclude the booking to be safe
        console.error("Error evaluating servicesRequested for booking", booking?.calendarEventId, err);
        return false;
      }
    });

    // Debug logging for each filtered booking
    // filtered.forEach((booking) => {
    //   XStateUtils.debugXState(booking, "SERVICES FILTER DEBUG");
    // });

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
