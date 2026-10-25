import { BookingStatusLabel, PageContextLevel, PagePermission } from "@/components/src/types";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyDashboardView,
  clearDashboardReturn,
  dashboardViewsEqual,
  defaultDashboardView,
  isSafeDashboardReturn,
  parseDashboardView,
  peekDashboardReturn,
  rememberDashboardReturn,
  staffBookingsPath,
  syncDashboardViewUrl,
} from "@/components/src/client/routes/components/bookingTable/dashboardView";

describe("dashboard view params", () => {
  afterEach(() => {
    clearDashboardReturn();
    window.history.pushState({}, "", "/");
  });

  it("omits role defaults from the url and keeps an unrelated param", () => {
    const current = new URLSearchParams("calendarEventId=evt-1");
    const next = applyDashboardView(
      current,
      defaultDashboardView(PageContextLevel.ADMIN),
      PageContextLevel.ADMIN,
    );

    expect(next.toString()).toBe("calendarEventId=evt-1");
  });

  it("round-trips a search and the filters that differ from the defaults", () => {
    const view = {
      searchQuery: "jane",
      dateRange: "Today" as const,
      statuses: [BookingStatusLabel.APPROVED],
      origins: ["User"],
      rooms: ["202"],
      services: ["Staffing"],
    };
    const params = applyDashboardView(
      new URLSearchParams("calendarEventId=evt-1"),
      view,
      PageContextLevel.ADMIN,
    );

    expect(params.get("calendarEventId")).toBe("evt-1");
    expect(parseDashboardView(params, PageContextLevel.ADMIN)).toEqual(view);
  });

  it("puts each filter type in a single comma-separated param", () => {
    const view = {
      ...defaultDashboardView(PageContextLevel.ADMIN),
      statuses: [BookingStatusLabel.APPROVED, BookingStatusLabel.PRE_APPROVED],
      origins: ["User", "Walk-In"],
      rooms: ["202", "203"],
      services: ["Staffing", "Equipment"],
    };
    const params = applyDashboardView(
      new URLSearchParams("calendarEventId=evt-1"),
      view,
      PageContextLevel.ADMIN,
    );

    expect(params.getAll("room")).toEqual(["202,203"]);
    expect(params.getAll("origin")).toEqual(["User,Walk-In"]);
    expect(params.getAll("service")).toEqual(["Staffing,Equipment"]);
    expect(params.getAll("status")).toEqual(["APPROVED,PRE-APPROVED"]);
    expect(params.get("calendarEventId")).toBe("evt-1");
    expect(parseDashboardView(params, PageContextLevel.ADMIN)).toEqual(view);
  });

  it("keeps a comma that is part of one filter value", () => {
    const view = {
      ...defaultDashboardView(PageContextLevel.ADMIN),
      rooms: ["202, Lab", "203"],
    };
    const params = applyDashboardView(
      new URLSearchParams(),
      view,
      PageContextLevel.ADMIN,
    );

    expect(parseDashboardView(params, PageContextLevel.ADMIN).rooms).toEqual([
      "202, Lab",
      "203",
    ]);
  });

  it("still reads filters that were stored as repeated params", () => {
    const params = new URLSearchParams();
    params.append("room", "202");
    params.append("room", "203");

    expect(parseDashboardView(params, PageContextLevel.ADMIN).rooms).toEqual([
      "202",
      "203",
    ]);
  });

  it("remembers a liaison who cleared the default requested status", () => {
    const view = {
      ...defaultDashboardView(PageContextLevel.LIAISON),
      statuses: [],
    };
    const params = applyDashboardView(
      new URLSearchParams(),
      view,
      PageContextLevel.LIAISON,
    );

    expect(params.get("status")).toBe("__none__");
    expect(
      dashboardViewsEqual(
        parseDashboardView(params, PageContextLevel.LIAISON),
        view,
      ),
    ).toBe(true);
  });

  it("updates the address bar in place when the view changes", () => {
    window.history.pushState({}, "", "/mc/admin?calendarEventId=evt-1");
    const view = {
      ...defaultDashboardView(PageContextLevel.ADMIN),
      rooms: ["202", "203"],
      searchQuery: "jane",
    };

    syncDashboardViewUrl(view, PageContextLevel.ADMIN);

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/mc/admin");
    expect(params.get("room")).toBe("202,203");
    expect(params.get("q")).toBe("jane");
    expect(params.get("calendarEventId")).toBe("evt-1");
    const search = window.location.search;
    syncDashboardViewUrl(view, PageContextLevel.ADMIN);
    expect(window.location.search).toBe(search);
  });

  it("accepts only this tenant's dashboard paths", () => {
    expect(isSafeDashboardReturn("mc", "/mc/services?q=jane")).toBe(true);
    expect(isSafeDashboardReturn("mc", "/mc")).toBe(true);
    expect(isSafeDashboardReturn("mc", "/mc/my-bookings?range=Today")).toBe(
      true,
    );
    expect(isSafeDashboardReturn("mc", "/other/admin")).toBe(false);
    expect(isSafeDashboardReturn("mc", "/mc/modification/abc")).toBe(false);
    expect(isSafeDashboardReturn("mc", "//evil.com")).toBe(false);
    expect(isSafeDashboardReturn("mc", "https://evil.com/mc/admin")).toBe(
      false,
    );
  });

  it("stores the current dashboard for a modification and ignores an edit read", () => {
    window.history.pushState({}, "", "/mc/services?q=jane&range=Today");
    rememberDashboardReturn("modification", "evt1");

    expect(peekDashboardReturn("modification", "mc")).toBe(
      "/mc/services?q=jane&range=Today",
    );
    expect(peekDashboardReturn("edit", "mc")).toBeNull();
    expect(peekDashboardReturn("modification", "other")).toBeNull();
  });

  it("sends a super admin back to the admin bookings table", () => {
    expect(staffBookingsPath("mc", PagePermission.SUPER_ADMIN)).toBe(
      "/mc/admin",
    );
    expect(staffBookingsPath("mc", PagePermission.SERVICES)).toBe(
      "/mc/services",
    );
  });
});
