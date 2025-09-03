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
      ];
    } else if (pageContext === PageContextLevel.EQUIPMENT) {
      // For Equipment page, show both legacy EQUIPMENT status and Service Requests needing Equipment approval
      return [BookingStatusLabel.EQUIPMENT, BookingStatusLabel.PRE_APPROVED];
    } else {
      const { WALK_IN, ...displayableStatuses } = BookingStatusLabel;
      return Object.values(displayableStatuses);
    }
  }, [pageContext]);

  return allowedStatuses;
}
