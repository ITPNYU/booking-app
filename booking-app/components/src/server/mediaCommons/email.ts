import {
  BookingFormDetailsMediaCommons,
  BookingMediaCommons,
} from "../../typesMediaCommons";
import { TableNamesRaw, Tenants, getTableName } from "../../policy";

import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { getBookingToolDeployUrl } from "../ui";

export const getMediaCommonsBookingContents = async (
  id: string
): Promise<BookingFormDetailsMediaCommons> => {
  const BOOKING = getTableName(TableNamesRaw.BOOKING, Tenants.MEDIA_COMMONS);
  return clientGetDataByCalendarEventId<BookingMediaCommons>(BOOKING, id)
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
