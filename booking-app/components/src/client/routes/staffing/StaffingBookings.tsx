import React, { useContext, useMemo } from "react";
import { Booking, PageContextLevel } from "../../../types";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const StaffingBookings: React.FC = () => {
  const { allBookings } = useContext(DatabaseContext);

  // Filter bookings to show only those with XState value "Service Requested"
  const staffingRequestedBookings = useMemo(() => {
    if (!allBookings || allBookings.length === 0) {
      return [];
    }

    return allBookings.filter((booking: Booking) => {
      // Check if booking has XState data
      if (!booking.xstateData) {
        return false;
      }

      // Use the same logic as Service approve/decline actions
      const { getXStateValue } = require("../../../utils/xstateHelpers");
      const currentXState = getXStateValue(booking);

      // Parse JSON if it's a string representation of an object
      let parsedState: any = currentXState;
      if (typeof currentXState === "string" && currentXState.startsWith("{")) {
        try {
          parsedState = JSON.parse(currentXState);
        } catch {
          parsedState = currentXState;
        }
      }

      const isInServicesRequest =
        (typeof parsedState === "object" &&
          parsedState &&
          parsedState["Services Request"]) ||
        (typeof parsedState === "string" &&
          (parsedState.includes("Services Request") ||
            parsedState === "Services Request" ||
            parsedState.includes("Service Requested") ||
            parsedState === "Service Requested"));

      // Enhanced debugging
      console.log(`🔍 STAFFING FILTER DEBUG:`, {
        calendarEventId: booking.calendarEventId,
        rawXState: currentXState,
        parsedState,
        parsedStateType: typeof parsedState,
        parsedStateKeys:
          typeof parsedState === "object" && parsedState
            ? Object.keys(parsedState)
            : null,
        hasServicesRequestKey:
          typeof parsedState === "object" &&
          parsedState &&
          parsedState["Services Request"],
        isInServicesRequest,
        title: booking.title,
      });

      return isInServicesRequest;
    });
  }, [allBookings]);

  console.log(
    `📋 STAFFING BOOKINGS: Found ${staffingRequestedBookings.length} bookings with "Service Requested" state`
  );

  // Create a custom context that only shows Service Requested bookings
  const customContext = {
    ...useContext(DatabaseContext),
    allBookings: staffingRequestedBookings,
  };

  return (
    <DatabaseContext.Provider value={customContext}>
      <Bookings pageContext={PageContextLevel.ADMIN} />
    </DatabaseContext.Provider>
  );
};

export default StaffingBookings;
