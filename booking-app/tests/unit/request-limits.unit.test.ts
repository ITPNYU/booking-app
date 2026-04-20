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

const mockTimestampFromDate = vi.fn((d: Date) => ({ __date: d }));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: (d: Date) => mockTimestampFromDate(d),
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  },
}));

describe("Request limits enforcement (POST /api/bookings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks when the per-period limit is reached for a resource+role", async () => {
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
      { id: "b1", roomIds: [1201], canceledAt: null, declinedAt: null },
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
          role: "student",
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
  });

  it("uses 4-month semester windows starting in Jan (May 1 starts a new window)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));

    mockServerGetDocumentById.mockResolvedValue({
      tenant: "mc",
      resources: [
        {
          roomId: 1201,
          name: "Room 1201",
          requestLimits: {
            perSemester: { student: 99 },
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
        selectedRooms: [{ roomId: 1201, calendarId: "cal-1201", name: "Room 1201" }],
        bookingCalendarInfo: {
          startStr: "2026-05-10T14:00:00Z",
          endStr: "2026-05-10T15:00:00Z",
        },
        data: {
          role: "student",
          title: "Test",
          department: "ITP",
        },
        isAutoApproval: false,
      }),
    }) as any;

    // We expect this not to fail due to limits; we only validate the window calculation inputs
    await POST(req);

    // Find at least one Timestamp.fromDate call for semester start at 2026-05-01T00:00:00Z
    const calledDates = mockTimestampFromDate.mock.calls.map((c) => c[0] as Date);
    const hasSemesterStart = calledDates.some(
      (d) =>
        d.toISOString() === "2026-05-01T00:00:00.000Z",
    );

    expect(hasSemesterStart).toBe(true);

    vi.useRealTimers();
  });

  it("uses configured term ranges for perSemester windows (fallTerm)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    mockServerGetDocumentById.mockResolvedValue({
      tenant: "mc",
      termConfig: {
        fallTerm: [9, 12],
        springTerm: [1, 5],
        summerTerm: [6, 8],
      },
      resources: [
        {
          roomId: 1201,
          name: "Room 1201",
          requestLimits: {
            perSemester: { student: 99 },
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
        selectedRooms: [{ roomId: "1201", calendarId: "cal-1201", name: "Room 1201" }],
        bookingCalendarInfo: {
          startStr: "2026-09-20T14:00:00Z",
          endStr: "2026-09-20T15:00:00Z",
        },
        data: {
          role: "student",
          title: "Test",
          department: "ITP",
        },
        isAutoApproval: false,
      }),
    }) as any;

    await POST(req);

    const calledDates = mockTimestampFromDate.mock.calls.map((c) => c[0] as Date);
    expect(calledDates.some((d) => d.toISOString() === "2026-09-01T00:00:00.000Z")).toBe(true);
    expect(calledDates.some((d) => d.toISOString() === "2027-01-01T00:00:00.000Z")).toBe(true);

    vi.useRealTimers();
  });
});

