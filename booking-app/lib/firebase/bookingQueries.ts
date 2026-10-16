import {
  clientFetchAllDataFromCollection,
  getPaginatedData,
} from "@/lib/firebase/firebase";
import { TableNames } from "@/components/src/policy";
import { Filters, PagePermission } from "@/components/src/types";

export const fetchAllFutureBooking = async <Booking>(
  tenant?: string,
): Promise<Booking[]> => {
  const nowMs = Date.now();
  return clientFetchAllDataFromCollection<Booking>(
    TableNames.BOOKING,
    [{ field: "endDate", op: ">", value: { __ts: nowMs } }],
    tenant,
  );
};

/**
 * "All Future" is the only open-ended range (`[startOfToday, null]`). It is
 * bounded by how far ahead bookings exist, not by `limit`, and the bookings
 * table applies its status / origin / room / service chips client-side — so
 * a LIMIT here silently drops every booking past the LIMIT-th one and the
 * chips can never match it (e.g. PRE-APPROVED bookings missing from the
 * Admin / Services table and the "Pre-Approved" chip returning nothing, while
 * search, which has no LIMIT, still finds them). Fetch the whole range, the
 * same set the search path already reads.
 */
const isOpenEndedRange = (dateRange: Filters["dateRange"]): boolean =>
  Array.isArray(dateRange) && dateRange.length === 2 && dateRange[1] == null;

export const fetchAllBookings = async <Booking>(
  pagePermission: PagePermission,
  limit: number,
  filters: Filters,
  last: any,
  tenant?: string,
): Promise<Booking[]> => {
  const pageLimit = isOpenEndedRange(filters.dateRange) ? null : limit;
  if (
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON ||
    pagePermission === PagePermission.PA
  ) {
    return getPaginatedData<Booking>(
      TableNames.BOOKING,
      pageLimit,
      filters,
      last,
      tenant,
    );
  }
  return getPaginatedData<Booking>(
    TableNames.BOOKING,
    pageLimit,
    filters,
    last,
    tenant,
  );
};
