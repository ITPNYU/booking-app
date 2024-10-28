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
        BookingStatusLabel.WALK_IN,
      ];
    } else if (pageContext === PageContextLevel.LIAISON) {
      return [BookingStatusLabel.REQUESTED];
    } else {
      return Object.values(BookingStatusLabel);
    }
  }, [pageContext]);

  return allowedStatuses;
}
