import {
  BookingFormDetailsMediaCommons,
  BookingMediaCommons,
} from "../../typesMediaCommons";
import { TableNamesRaw, Tenants, getTableName } from "../../policy";

import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";

export const serverBookingContents = async (
  id: string
): Promise<BookingFormDetailsMediaCommons> => {
  const BOOKING = getTableName(TableNamesRaw.BOOKING, Tenants.MEDIA_COMMONS);
  return serverGetDataByCalendarEventId<BookingMediaCommons>(BOOKING, id)
    .then((bookingObj) => {
      const updatedBookingObj = Object.assign({}, bookingObj, {
        headerMessage: "This is a request email for final approval.",
        // TODO should this have need bookingToolUrl?
      });

      return updatedBookingObj;
    })
    .catch((error) => {
      console.error("Error fetching booking contents:", error);
      throw error;
    });
};
