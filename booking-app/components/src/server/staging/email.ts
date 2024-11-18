import { BookingFormDetailsStaging, BookingStaging } from "../../typesStaging";
import { TableNamesRaw, Tenants, getTableName } from "../../policy";

import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { getBookingToolDeployUrl } from "../ui";

export const getStagingBookingContents = async (
  id: string
): Promise<BookingFormDetailsStaging> => {
  const BOOKING = getTableName(TableNamesRaw.BOOKING, Tenants.STAGING);
  return clientGetDataByCalendarEventId<BookingStaging>(BOOKING, id)
    .then((bookingObj) => {
      const updatedBookingObj = {
        ...bookingObj,
        headerMessage: "This is a request email for final approval.",
        bookingToolUrl: getBookingToolDeployUrl(),
      };

      return updatedBookingObj;
    })
    .catch((error) => {
      console.error("Error fetching booking contents:", error);
      throw error;
    });
};
