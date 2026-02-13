import { useContext, useEffect } from "react";
import { usePathname, useRouter, useParams } from "next/navigation";

import { BookingContext } from "../bookingProvider";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useParams();

  const { role, department, selectedRooms, bookingCalendarInfo, formData } =
    useContext(BookingContext);

  const hasAffiliationFields =
    (role && department) || pathname.includes("/modification");
  const hasRoomSelectionFields =
    selectedRooms &&
    bookingCalendarInfo &&
    bookingCalendarInfo.startStr &&
    bookingCalendarInfo.endStr;

  const hasFormData = formData;

  useEffect(() => {
    let isMissing = false;
    if (pathname.includes("/selectRoom")) {
      isMissing = !hasAffiliationFields;
    } else if (pathname.includes("/form")) {
      isMissing = !(hasAffiliationFields && hasRoomSelectionFields);
    } else if (pathname.includes("/confirmation")) {
      isMissing = !(
        hasAffiliationFields &&
        hasRoomSelectionFields &&
        hasFormData
      );
    }

    if (isMissing) {
      const segments = pathname.split("/");
      const base = segments[2]; // e.g., "book", "edit", "walk-in", "vip"
      const stepNames = ["selectRoom", "form", "confirmation", "role", "netid"];

      // Path structures:
      // /tenant/book/selectRoom (no id) - segments: ["", tenant, "book", "selectRoom"]
      // /tenant/edit/selectRoom/abc123 (with id) - segments: ["", tenant, "edit", "selectRoom", "abc123"]
      // The step is always at segments[3], and id (if present) is at segments[4]
      const step = segments[3] ?? "";
      const id = stepNames.includes(step) ? (segments[4] ?? "") : "";

      console.log("MISSING DATA - redirecting:", { pathname, base, step, id, isMissing });

      // Redirect to the role page (or netid for walk-in) to collect affiliation
      if (!hasAffiliationFields) {
        const roleStep = base === "walk-in" ? "netid" : "role";
        router.push(`/${tenant}/${base}/${roleStep}${id ? `/${id}` : ""}`);
      } else {
        // Missing room selection or form data - go to selectRoom
        router.push(`/${tenant}/${base}/selectRoom${id ? `/${id}` : ""}`);
      }
    }
  }, []);
}
