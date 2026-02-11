import { TableNames } from "@/components/src/policy";
import { Booking } from "@/components/src/types";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

// ── Bookings cache with request coalescing ──
// When multiple rooms fire concurrent requests, bookings (identical for all rooms)
// are fetched from Firestore only ONCE and shared across all concurrent requests.
const BOOKINGS_CACHE_TTL = 30_000; // 30 seconds
let bookingsCacheData: {
  data: Booking[];
  timestamp: number;
  tenant: string;
} | null = null;
let bookingsInflightPromise: Promise<Booking[]> | null = null;

/** @internal – exposed only for unit tests to reset module-level cache between runs */
export function _resetBookingsCacheForTesting() {
  bookingsCacheData = null;
  bookingsInflightPromise = null;
}

export async function getCachedBookings(tenant: string): Promise<Booking[]> {
  const now = Date.now();

  // Return cached data if still fresh and for the same tenant
  if (
    bookingsCacheData &&
    bookingsCacheData.tenant === tenant &&
    now - bookingsCacheData.timestamp < BOOKINGS_CACHE_TTL
  ) {
    return bookingsCacheData.data;
  }

  // Coalesce concurrent requests – only the first caller fetches
  if (!bookingsInflightPromise) {
    bookingsInflightPromise = serverFetchAllDataFromCollection<Booking>(
      TableNames.BOOKING,
      [],
      tenant,
    )
      .then((data) => {
        bookingsCacheData = { data, timestamp: Date.now(), tenant };
        bookingsInflightPromise = null;
        return data;
      })
      .catch((err) => {
        bookingsInflightPromise = null;
        throw err;
      });
  }

  return bookingsInflightPromise;
}
