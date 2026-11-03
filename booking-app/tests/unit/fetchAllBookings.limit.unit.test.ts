import { PagePermission } from "@/components/src/types";
import { fetchAllBookings } from "@/lib/firebase/bookingQueries";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({}));

/**
 * Guards the request `fetchAllBookings` sends to /api/firestore/paginated.
 *
 * The bookings table applies its status / origin / room / service chips
 * client-side, so they can only match rows the fetch returned. A LIMIT on the
 * open-ended "All Future" range silently drops every booking past the
 * LIMIT-th one (issue #1604: PRE-APPROVED bookings missing from the Admin /
 * Services table, and the "Pre-Approved" chip returning nothing, while search
 * — which has no LIMIT — still finds them).
 */

const LIMIT = 500;

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => ({ docs: [] }),
}));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastBody() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

const startOfToday = new Date("2026-10-05T04:00:00.000Z");

describe("fetchAllBookings — LIMIT on the paginated request", () => {
  it.each([
    PagePermission.ADMIN,
    PagePermission.SERVICES,
    PagePermission.LIAISON,
    PagePermission.PA,
  ])(
    "fetches the whole open-ended 'All Future' range for %s (no limit)",
    async (permission) => {
      await fetchAllBookings(
        permission,
        LIMIT,
        {
          dateRange: [startOfToday, null] as unknown as Date[],
          sortField: "startDate",
          sortDirection: "asc",
          searchQuery: "",
        },
        null,
        "mc",
      );

      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/firestore/paginated");
      expect(lastBody()).not.toHaveProperty("limit");
    },
  );

  it("keeps the LIMIT for bounded date ranges", async () => {
    await fetchAllBookings(
      PagePermission.ADMIN,
      LIMIT,
      {
        dateRange: [
          new Date("2026-04-05T04:00:00.000Z"),
          new Date("2026-10-05T04:00:00.000Z"),
        ],
        sortField: "startDate",
        searchQuery: "",
      },
      null,
      "mc",
    );

    expect(lastBody().limit).toBe(LIMIT);
  });

  it("still forwards the date range and sort to the route", async () => {
    await fetchAllBookings(
      PagePermission.ADMIN,
      LIMIT,
      {
        dateRange: [startOfToday, null] as unknown as Date[],
        sortField: "startDate",
        sortDirection: "asc",
        searchQuery: "",
      },
      null,
      "mc",
    );

    expect(lastBody()).toMatchObject({
      collection: "bookings",
      tenant: "mc",
      filters: {
        dateRange: [startOfToday.toISOString(), null],
        sortField: "startDate",
        sortDirection: "asc",
      },
    });
  });
});
