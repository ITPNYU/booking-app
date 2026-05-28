import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerGetDocumentById = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) => mockServerGetDocumentById(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
  // POST route imports these too, but our tests should short-circuit before they matter
  logServerBookingChange: vi.fn(),
  serverGetNextSequentialId: vi.fn(),
  serverSaveDataToFirestore: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({}));
vi.mock("@/components/src/server/serviceApproverNotifications", () => ({
  isServicesRequestState: () => false,
  notifyServiceApproversForRequestedServices: vi.fn(),
}));
vi.mock("@/components/src/server/calendars", () => ({
  bookingContentsToDescription: vi.fn(async () => ""),
  insertEvent: vi.fn(async () => ({ id: "cal-id" })),
}));
vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn(async () => ({
    schemaName: "Test Schema",
    emailMessages: {
      firstApprovalRequest: "",
      requestConfirmation: "",
    },
  })),
}));
vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: vi.fn(async () => ({
    events: { list: vi.fn(async () => ({ data: { items: [] } })) },
  })),
}));
vi.mock("@/lib/utils/calendarEnvironment", () => ({
  applyEnvironmentCalendarIds: (resources: any[]) => resources,
}));
vi.mock("@/lib/stateMachines/itpBookingMachine", () => ({
  itpBookingMachine: { id: "itp", initial: "Requested" },
}));
vi.mock("@/lib/stateMachines/mcBookingMachine", () => ({
  mcBookingMachine: { id: "mc", initial: "Requested" },
}));
vi.mock("xstate", () => ({
  createActor: () => ({
    start: () => {},
    stop: () => {},
    getSnapshot: () => ({ value: "Requested", context: {}, can: () => false }),
    getPersistedSnapshot: () => ({ value: "Requested", context: {} }),
  }),
}));
vi.mock("./shared", () => ({
  extractTenantFromRequest: () => "mc",
  getAffiliationDisplayValues: () => ({ departmentDisplay: "", schoolDisplay: "" }),
  getOtherDisplayFields: () => ({}),
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
    fromDate: (d: Date) => ({
      toDate: () => d,
      toMillis: () => d.getTime(),
    }),
  },
}));

describe("Request limits enforcement (POST /api/bookings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks when the per-period limit is reached for a resource+role", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));

    mockServerGetDocumentById.mockResolvedValue({
      tenant: "mc",
      resources: [
        {
          roomId: 1201,
          name: "Room 1201",
          requestLimits: {
            perSemester: { student: 1 },
          },
        },
      ],
    });

    mockServerFetchAllDataFromCollection.mockResolvedValue([
      // Active booking in-window for same resource
      {
        id: "b1",
        roomIds: [1201],
        role: "Student",
        requestedAt: { toMillis: () => new Date("2026-04-13T10:00:00Z").getTime() },
        canceledAt: null,
        declinedAt: null,
      },
    ]);

    const { POST } = await import("@/app/api/bookings/route");
    const req = new Request("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@nyu.edu",
        selectedRooms: [{ roomId: 1201, calendarId: "cal-1201", name: "Room 1201" }],
        bookingCalendarInfo: {
          startStr: "2026-04-13T14:00:00Z",
          endStr: "2026-04-13T15:00:00Z",
        },
        data: {
          role: "Student",
          title: "Test",
          department: "ITP",
        },
        isAutoApproval: false,
      }),
    }) as any;

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain("Request limit reached");
    expect(body.error).toContain("perSemester");

    vi.useRealTimers();
  });

  it("uses 4-month semester windows in America/New_York (May 1 starts a new window)", async () => {
    const { getNewYorkWindowForPeriod, REQUEST_LIMITS_TIME_ZONE } =
      await import("@/lib/bookingRequestLimits");
    const { toDate } = await import("date-fns-tz");
    const tz = REQUEST_LIMITS_TIME_ZONE;
    const now = toDate("2026-05-01T12:00:00.000", { timeZone: tz });
    const { start, end } = getNewYorkWindowForPeriod(now, "perSemester", undefined);

    expect(start.getTime()).toBe(
      toDate("2026-05-01T00:00:00.000", { timeZone: tz }).getTime(),
    );
    expect(end.getTime()).toBe(
      toDate("2026-09-01T00:00:00.000", { timeZone: tz }).getTime(),
    );
  });

  it("bounds the Firestore bookings query by the earliest active window start", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-13T12:00:00Z"));

    mockServerGetDocumentById.mockResolvedValue({
      tenant: "mc",
      resources: [
        {
          roomId: 1201,
          name: "Room 1201",
          requestLimits: {
            // perDay limit forces the window to be the current calendar day,
            // which is much narrower than the full booking history.
            perDay: { student: 5 },
          },
        },
      ],
    });

    mockServerFetchAllDataFromCollection.mockResolvedValue([]);

    const { POST } = await import("@/app/api/bookings/route");
    const req = new Request("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "student@nyu.edu",
        selectedRooms: [
          { roomId: 1201, calendarId: "cal-1201", name: "Room 1201" },
        ],
        bookingCalendarInfo: {
          startStr: "2026-04-13T14:00:00Z",
          endStr: "2026-04-13T15:00:00Z",
        },
        data: { role: "Student", title: "Test", department: "ITP" },
        isAutoApproval: false,
      }),
    }) as any;

    await POST(req);

    const bookingQueryCall = mockServerFetchAllDataFromCollection.mock.calls.find(
      (call) => call[0] === "bookings",
    );
    expect(bookingQueryCall).toBeDefined();
    const constraints = bookingQueryCall![1] as Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    const requestedAtBound = constraints.find(
      (c) => c.field === "requestedAt" && c.operator === ">=",
    );
    expect(requestedAtBound).toBeDefined();
    // perDay window in America/New_York for 2026-04-13 12:00Z (08:00 ET) → starts 2026-04-13 00:00 ET (= 04:00Z)
    const lowerBoundMs = (requestedAtBound!.value as any).toMillis();
    expect(lowerBoundMs).toBe(new Date("2026-04-13T04:00:00Z").getTime());

    vi.useRealTimers();
  });

  it("uses configured term ranges for perSemester windows (fallTerm) in America/New_York", async () => {
    const { getNewYorkWindowForPeriod, REQUEST_LIMITS_TIME_ZONE } =
      await import("@/lib/bookingRequestLimits");
    const { toDate } = await import("date-fns-tz");
    const tz = REQUEST_LIMITS_TIME_ZONE;
    const now = toDate("2026-09-15T12:00:00.000", { timeZone: tz });
    const { start, end } = getNewYorkWindowForPeriod(now, "perSemester", {
      fallTerm: [9, 12],
      springTerm: [1, 5],
      summerTerm: [6, 8],
    });

    expect(start.getTime()).toBe(
      toDate("2026-09-01T00:00:00.000", { timeZone: tz }).getTime(),
    );
    expect(end.getTime()).toBe(
      toDate("2027-01-01T00:00:00.000", { timeZone: tz }).getTime(),
    );
  });
});

