import React, { useContext, useMemo } from "react";
import { Booking, PageContextLevel } from "../../../types";
import { getXStateValue, logXStateDebug } from "../../../utils/xstateHelpers";
import { Bookings } from "../components/bookingTable/Bookings";
import { DatabaseContext } from "../components/Provider";

const ServicesBookings: React.FC = () => {
  const { allBookings } = useContext(DatabaseContext);

  // Filter bookings to show only those with XState value "Service Requested"
  const servicesRequestedBookings = useMemo(() => {
    if (!allBookings || allBookings.length === 0) {
      return [];
    }

    return allBookings.filter((booking: Booking) => {
      // Check if booking has XState data
      if (!booking.xstateData) {
        return false; // Exclude bookings without XState data
      }

      try {
        // Get current XState value using the utility function
        const currentXState = getXStateValue(booking);

        if (!currentXState) return false;

        // Parse JSON if it's a string representation of an object
        let parsedState: any = currentXState;
        if (
          typeof currentXState === "string" &&
          currentXState.startsWith("{")
        ) {
          try {
            parsedState = JSON.parse(currentXState);
          } catch {
            parsedState = currentXState;
          }
        }

        // Check for service request states
        const isInServicesRequest =
          // Object state check
          (typeof parsedState === "object" &&
            parsedState &&
            parsedState["Services Request"]) ||
          // String state check
          (typeof parsedState === "string" &&
            (parsedState.includes("Services Request") ||
              parsedState === "Services Request"));

        // Use the built-in debug helper
        logXStateDebug(booking, "SERVICES FILTER DEBUG");

        // Additional debug info specific to services
        console.log(`🔍 SERVICES REQUEST:`, {
          calendarEventId: booking.calendarEventId,
          isInServicesRequest,
          title: booking.title,
        });

        return isInServicesRequest;
      } catch (error) {
        console.error(
          "Error filtering booking:",
          error,
          booking.calendarEventId
        );
        return false;
      }
    });
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
