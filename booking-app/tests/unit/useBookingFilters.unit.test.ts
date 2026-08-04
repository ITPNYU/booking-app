import { describe, expect, it } from "vitest";

import { getServiceFilterKey } from "@/components/src/client/routes/components/bookingTable/hooks/useBookingFilters";

describe("getServiceFilterKey", () => {
  it("maps staffing to its stored service key", () => {
    expect(getServiceFilterKey("Staffing")).toBe("staff");
  });

  it("normalizes other service labels", () => {
    expect(getServiceFilterKey("Equipment")).toBe("equipment");
  });

  it("ignores malformed service filter entries", () => {
    expect(getServiceFilterKey(undefined)).toBeNull();
    expect(getServiceFilterKey(null)).toBeNull();
  });
});
