import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";

import { useMemo } from "react";

export default function useAllowedStatuses(pageContext: PageContextLevel) {
  const allowedStatuses = useMemo(() => {
    if (pageContext === PageContextLevel.PA) {
      return [
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.CHECKED_IN,
        BookingStatusLabel.CHECKED_OUT,
        BookingStatusLabel.NO_SHOW,
        BookingStatusLabel.CLOSED,
      ];
    }
    // NOTE marks a history note, never a booking's status, so there's
    // nothing to filter by.
    const { WALK_IN, NOTE, ...displayableStatuses } = BookingStatusLabel;
    return Object.values(displayableStatuses);
  }, [pageContext]);

  return allowedStatuses;
}
