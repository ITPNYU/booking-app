import { BookingMediaCommons } from "../../typesMediaCommons";
import { BookingStaging } from "../../typesStaging";

export function isTypeMediaCommons(val: any): val is BookingMediaCommons {
  return val.hasOwnProperty("chartFieldForSecurity");
}

export function isTypeStaging(val: any): val is BookingStaging {
  return val.hasOwnProperty("projectDatabaseUrl");
}

// export function getMediaCommonsField(
//   obj: BookingRow | Booking,
//   field: keyof (BookingMediaCommons & BookingStatus)
// ) {
//   if (isTypeMediaCommons(obj)) {
//     return obj[field];
//   }
//   throw Error(`Tried to access field ${field} of a non-Media Commons booking`);
// }

// export function getStagingField(
//   obj: BookingRow | Booking,
//   field: keyof (BookingStaging & BookingStatus)
// ) {
//   if (isTypeStaging(obj)) {
//     return obj[field];
//   }
//   throw Error(`Tried to access field ${field} of a non-Staging Space booking`);
// }
