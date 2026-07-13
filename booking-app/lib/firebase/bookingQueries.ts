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

export const fetchAllBookings = async <Booking>(
  pagePermission: PagePermission,
  limit: number,
  filters: Filters,
  last: any,
  tenant?: string,
): Promise<Booking[]> => {
  if (
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON ||
    pagePermission === PagePermission.PA
  ) {
    return getPaginatedData<Booking>(
      TableNames.BOOKING,
      limit,
      filters,
      last,
      tenant,
    );
  }
  return getPaginatedData<Booking>(
    TableNames.BOOKING,
    limit,
    filters,
    last,
    tenant,
  );
};
