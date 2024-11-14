import { Tenants } from "@/components/src/policy";
import { useMediaCommonsDatabase } from "@/components/src/client/providers/MediaCommonsDatabaseProvider";
import { useStagingDatabase } from "@/components/src/client/providers/StagingDatabaseProvider";
import useTenant from "@/components/src/client/utils/useTenant";

export default function useBookings() {
  const tenant = useTenant();
  const { bookings: bookingsMediaCommons } = useMediaCommonsDatabase();
  const { bookings: bookingsStaging } = useStagingDatabase();

  switch (tenant) {
    case Tenants.MEDIA_COMMONS:
      return bookingsMediaCommons;
    case Tenants.STAGING:
      return bookingsStaging;
    default:
      return [];
  }
}
