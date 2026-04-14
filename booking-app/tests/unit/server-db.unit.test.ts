import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientFetchAllDataFromCollection = vi.fn();
const mockClientGetDataByCalendarEventId = vi.fn();
const mockClientSaveDataToFirestore = vi.fn();
const mockClientUpdateDataInFirestore = vi.fn();
const mockGetPaginatedData = vi.fn();
const mockClientUpdateDataByCalendarEventId = vi.fn();
const mockClientGetFinalApproverEmail = vi.fn();
const mockShouldUseXState = vi.fn();
const mockGetTenantEmailConfig = vi.fn();

const mockTimestampNow = vi.fn();
const mockWhere = vi.fn();

const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateInFirestore = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockAdminTimestampNow = vi.fn();

vi.mock("firebase/firestore", () => ({
  Timestamp: { now: mockTimestampNow },
  where: mockWhere,
}));

vi.mock("@/lib/firebase/firebase", () => ({
  clientFetchAllDataFromCollection: mockClientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId: mockClientGetDataByCalendarEventId,
  clientSaveDataToFirestore: mockClientSaveDataToFirestore,
  clientUpdateDataInFirestore: mockClientUpdateDataInFirestore,
  getPaginatedData: mockGetPaginatedData,
}));

vi.mock("@/lib/firebase/client/clientDb", () => ({
  clientUpdateDataByCalendarEventId: mockClientUpdateDataByCalendarEventId,
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  shouldUseXState: mockShouldUseXState,
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    PRE_BAN_LOGS: "preBanLogs",
    BOOKING_LOGS: "bookingLogs",
  },
  ApproverLevel: {
    FINAL: 2,
  },
  getApprovalCcEmail: vi.fn(),
  getCancelCcEmail: vi.fn(),
  clientGetFinalApproverEmail: mockClientGetFinalApproverEmail,
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    DECLINED: "DECLINED",
    APPROVED: "APPROVED",
    CANCELED: "CANCELED",
    NO_SHOW: "NO_SHOW",
  },
  PagePermission: {
    ADMIN: "ADMIN",
    LIAISON: "LIAISON",
    PA: "PA",
    STUDENT: "STUDENT",
  },
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mockGetTenantEmailConfig,
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: (...args: any[]) =>
    mockServerGetDataByCalendarEventId(...args),
  serverUpdateInFirestore: (...args: any[]) =>
    mockServerUpdateInFirestore(...args),
  serverSaveDataToFirestore: (...args: any[]) =>
    mockServerSaveDataToFirestore(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
  serverGetDocumentById: vi.fn(async () => null),
  logServerBookingChange: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
}));

vi.mock("firebase-admin", () => ({
  firestore: {
    Timestamp: {
      now: (...args: any[]) => mockAdminTimestampNow(...args),
    },
  },
}));

describe("server/db", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockTimestampNow.mockReturnValue({
      toDate: () => new Date("2024-05-01T00:00:00.000Z"),
    });
    mockWhere.mockImplementation((field: string, operator: string, value: any) => ({
      field,
      operator,
      value,
    }));

    mockClientFetchAllDataFromCollection.mockResolvedValue([]);
    mockGetPaginatedData.mockResolvedValue([]);
    mockClientGetFinalApproverEmail.mockResolvedValue("final@nyu.edu");
    mockShouldUseXState.mockReturnValue(false);
    mockGetTenantEmailConfig.mockResolvedValue({
      schemaName: "Media Commons",
      emailMessages: {
        requestConfirmation: "",
        firstApprovalRequest: "",
        secondApprovalRequest: "",
        walkInConfirmation: "",
        vipConfirmation: "",
        checkoutConfirmation: "",
        checkinConfirmation: "",
        declined: "Declined message",
        canceled: "",
        lateCancel: "Late cancel count: ${violationCount}",
        noShow: "",
        closed: "",
        approvalNotice: "",
      },
    });

    mockAdminTimestampNow.mockReturnValue("admin-now");
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-1",
      requestNumber: 42,
      email: "guest@nyu.edu",
      startDate: { toDate: () => new Date("2024-05-01T10:00:00.000Z") },
      endDate: { toDate: () => new Date("2024-05-01T11:00:00.000Z") },
      requestedAt: { toDate: () => new Date("2024-04-01T10:00:00.000Z") },
    });
    mockServerUpdateInFirestore.mockResolvedValue(undefined);
    mockServerSaveDataToFirestore.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
    mockClientGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-1",
      requestNumber: 42,
      email: "guest@nyu.edu",
      startDate: { toDate: () => new Date("2024-05-01T10:00:00.000Z") },
      endDate: { toDate: () => new Date("2024-05-01T11:00:00.000Z") },
      requestedAt: { toDate: () => new Date("2024-04-01T10:00:00.000Z") },
    });

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ newState: "Declined" }),
      text: async () => "ok",
    });

    global.fetch = mockFetch as unknown as typeof fetch;
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");
  });

  it("fetchAllFutureBooking queries future bookings for tenant", async () => {
    const { fetchAllFutureBooking } = await import(
      "@/components/src/server/db"
    );

    mockClientFetchAllDataFromCollection.mockResolvedValueOnce([
      { id: "booking" },
    ]);

    const result = await fetchAllFutureBooking("tenant-1");

    expect(mockWhere).toHaveBeenCalledWith("endDate", ">", expect.anything());
    expect(mockClientFetchAllDataFromCollection).toHaveBeenCalledWith(
      "bookings",
      [expect.objectContaining({ field: "endDate", operator: ">" })],
      "tenant-1",
    );
    expect(result).toEqual([{ id: "booking" }]);
  });

  it("processCancelBooking ignores excused logs when computing violationCount (late cancel email)", async () => {
    // Freeze "now" used by late-cancel detection inside server/db.ts
    mockAdminTimestampNow.mockReturnValue({
      toDate: () => new Date("2024-05-01T00:00:00.000Z"),
    });

    // Make cancel user-initiated (not automatic): prior status not NO_SHOW/DECLINED.
    mockServerFetchAllDataFromCollection.mockImplementation(
      async (tableName: string) => {
        if (tableName === "bookingLogs") {
          return [{ status: "APPROVED", changedAt: { seconds: 100 } }];
        }
        if (tableName === "preBanLogs") {
          return [
            { netId: "netX", excused: true },
            { netId: "netX", excused: false },
            { netId: "netX" }, // missing excused counts
            { netId: "someoneElse", excused: false },
          ];
        }
        return [];
      },
    );

    // Force late-cancel condition: start within 24h of now, and booking created > 1h ago.
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-99",
      requestNumber: 99,
      email: "guest@nyu.edu",
      startDate: { toDate: () => new Date("2024-05-01T10:00:00.000Z") },
      requestedAt: { toDate: () => new Date("2024-04-30T00:00:00.000Z") },
    });

    const { processCancelBooking } = await import("@/components/src/server/db");
    await processCancelBooking(
      "cal-lc-1",
      "user@nyu.edu",
      "netX",
      "media_commons",
    );

    expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarEventId: "cal-lc-1",
        targetEmail: "guest@nyu.edu",
        headerMessage: "Late cancel count: 2",
        status: "CANCELED",
      }),
    );
  });

  it("fetchAllBookings delegates to getPaginatedData", async () => {
    const { fetchAllBookings } = await import(
      "@/components/src/server/db"
    );
    const { PagePermission } = await import("@/components/src/types");

    mockGetPaginatedData.mockResolvedValueOnce(["booking-a"]);

    const result = await fetchAllBookings(
      PagePermission.ADMIN,
      25,
      { status: "REQUESTED" } as any,
      undefined,
      "tenant-a",
    );

    expect(mockGetPaginatedData).toHaveBeenCalledWith(
      "bookings",
      25,
      { status: "REQUESTED" },
      undefined,
      "tenant-a",
    );
    expect(result).toEqual(["booking-a"]);
  });

  it("clientGetBookingLogs fetches and normalizes log entries", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { status: "APPROVED", changedAt: "2024-01-01T00:00:00.000Z" },
      ],
    } as Response);

    const { clientGetBookingLogs } = await import(
      "@/components/src/server/db"
    );

    const logs = await clientGetBookingLogs(77);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://booking.test/api/booking-logs?requestNumber=77",
    );
    expect(logs).toEqual([
      { status: "APPROVED", changedAt: "2024-01-01T00:00:00.000Z" },
    ]);
  });

  it("clientSendConfirmationEmail looks up final approver and forwards email", async () => {
    const module = await import("@/components/src/server/db");

    await module.clientSendConfirmationEmail(
      "evt-1",
      "APPROVED",
      "Great news",
      "tenant-2",
    );

    // Allow the internal asynchronous email dispatch to resolve
    await Promise.resolve();

    expect(mockClientGetFinalApproverEmail).toHaveBeenCalled();
    expect(mockClientGetDataByCalendarEventId).toHaveBeenCalledWith(
      "bookings",
      "evt-1",
      "tenant-2",
    );
  });

  it("clientSendBookingDetailEmail posts email payload to API", async () => {
    const module = await import("@/components/src/server/db");

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    await module.clientSendBookingDetailEmail(
      "evt-2",
      "guest@nyu.edu",
      "Header",
      "APPROVED",
      "tenant-3",
    );

    const emailCall = mockFetch.mock.calls.find(
      ([url]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCall).toBeDefined();

    const [, requestInit] = emailCall!;
    const payload = JSON.parse((requestInit as RequestInit).body as string);
    expect(payload.targetEmail).toBe("guest@nyu.edu");
    expect(payload.status).toBe("APPROVED");
  });

  describe("cancel", () => {
    const makeResponse = (data: any, ok = true) =>
      ({
        ok,
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as Response;

    it("calls /api/cancel-processing after successful XState transition (MC tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Canceled" });
        }
        return makeResponse({});
      });

      const { cancel } = await import("@/components/src/server/db");
      await cancel("cal-1", "user@nyu.edu", "net123", "media_commons");

      const cancelProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/cancel-processing"),
      );
      expect(cancelProcessingCall).toBeDefined();
      const payload = JSON.parse(String(cancelProcessingCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-1",
        email: "user@nyu.edu",
        netId: "net123",
        tenant: "media_commons",
      });
    });

    it("calls /api/cancel-processing after successful XState transition (ITP tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Canceled" });
        }
        return makeResponse({});
      });

      const { cancel } = await import("@/components/src/server/db");
      await cancel("cal-2", "user@nyu.edu", "net456", "itp");

      const cancelProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/cancel-processing"),
      );
      expect(cancelProcessingCall).toBeDefined();
      const payload = JSON.parse(String(cancelProcessingCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-2",
        tenant: "itp",
      });
    });

    it("does NOT call cancel-processing when XState transition fails (falls back)", async () => {
      const fetchCalls: Array<{ href: string }> = [];
      mockFetch.mockImplementation((url: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ error: "boom" }, false);
        }
        return makeResponse({});
      });

      const { cancel } = await import("@/components/src/server/db");
      await cancel("cal-3", "user@nyu.edu", "net789", "media_commons");

      const cancelProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/cancel-processing"),
      );
      expect(cancelProcessingCall).toBeUndefined();
    });
  });

  describe("noShow", () => {
    const makeResponse = (data: any, ok = true) =>
      ({
        ok,
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as Response;

    it("executeTraditionalNoShow calls deleteBookingCalendarEvents API to free the slot", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });
        return makeResponse({});
      });

      const { executeTraditionalNoShow } = await import("@/components/src/server/db");
      await executeTraditionalNoShow(
        "cal-ns-1",
        "admin@nyu.edu",
        "net123",
        "media_commons",
      );

      const calendarPrefixCall = fetchCalls.find((c) =>
        c.href.includes("/api/calendarEvents"),
      );
      expect(calendarPrefixCall).toBeDefined();

      const deleteCall = fetchCalls.find((c) =>
        c.href.includes("/api/deleteBookingCalendarEvents"),
      );
      expect(deleteCall).toBeDefined();

      const payload = JSON.parse(String(deleteCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-ns-1",
        tenant: "media_commons",
      });
    });

    it("noShow (XState) calls deleteBookingCalendarEvents when transition jumps directly to Closed", async () => {
      mockShouldUseXState.mockReturnValue(true);

      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Closed" });
        }

        return makeResponse({});
      });

      const { noShow } = await import("@/components/src/server/db");
      await noShow("cal-ns-closed-1", "admin@nyu.edu", "net999", "itp");

      const deleteCall = fetchCalls.find((c) =>
        c.href.includes("/api/deleteBookingCalendarEvents"),
      );
      expect(deleteCall).toBeDefined();

      const payload = JSON.parse(String(deleteCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-ns-closed-1",
        tenant: "itp",
      });
    });
  });

  describe("checkin", () => {
    const makeResponse = (data: any, ok = true) =>
      ({
        ok,
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as Response;

    it("calls /api/checkin-processing after successful XState transition (MC tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Checked In" });
        }
        return makeResponse({});
      });

      const { checkin } = await import("@/components/src/server/db");
      await checkin("cal-ci-1", "admin@nyu.edu", "media_commons");

      const checkinProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/checkin-processing"),
      );
      expect(checkinProcessingCall).toBeDefined();
      const payload = JSON.parse(String(checkinProcessingCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-ci-1",
        email: "admin@nyu.edu",
        tenant: "media_commons",
      });
    });

    it("calls /api/checkin-processing after successful XState transition (ITP tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Checked In" });
        }
        return makeResponse({});
      });

      const { checkin } = await import("@/components/src/server/db");
      await checkin("cal-ci-2", "admin@nyu.edu", "itp");

      const checkinProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/checkin-processing"),
      );
      expect(checkinProcessingCall).toBeDefined();
      const payload = JSON.parse(String(checkinProcessingCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-ci-2",
        tenant: "itp",
      });
    });

    it("throws when XState transition fails", async () => {
      mockFetch.mockImplementation((url: any) => {
        const href = typeof url === "string" ? url : url.toString();
        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ error: "invalid state" }, false);
        }
        return makeResponse({});
      });

      const { checkin } = await import("@/components/src/server/db");
      await expect(
        checkin("cal-ci-3", "admin@nyu.edu", "media_commons"),
      ).rejects.toThrow("XState checkin failed");
    });
  });

  describe("checkOut", () => {
    const makeResponse = (data: any, ok = true) =>
      ({
        ok,
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as Response;

    it("calls /api/checkout-processing after successful XState transition (MC tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Checked Out" });
        }
        return makeResponse({});
      });

      const { checkOut } = await import("@/components/src/server/db");
      await checkOut("cal-co-1", "admin@nyu.edu", "media_commons");

      const checkoutProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/checkout-processing"),
      );
      expect(checkoutProcessingCall).toBeDefined();
      const payload = JSON.parse(String(checkoutProcessingCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-co-1",
        email: "admin@nyu.edu",
        tenant: "media_commons",
      });
    });

    it("calls /api/checkout-processing after successful XState transition (ITP tenant)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Checked Out" });
        }
        return makeResponse({});
      });

      const { checkOut } = await import("@/components/src/server/db");
      await checkOut("cal-co-2", "admin@nyu.edu", "itp");

      const checkoutProcessingCall = fetchCalls.find((c) =>
        c.href.includes("/api/checkout-processing"),
      );
      expect(checkoutProcessingCall).toBeDefined();
    });

    it("calls /api/close-processing when auto-close occurs (newState=Closed)", async () => {
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url: any, options: any) => {
        const href = typeof url === "string" ? url : url.toString();
        fetchCalls.push({ href, options });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ newState: "Closed" });
        }
        return makeResponse({});
      });

      const { checkOut } = await import("@/components/src/server/db");
      await checkOut("cal-co-3", "admin@nyu.edu", "itp");

      const checkoutCall = fetchCalls.find((c) =>
        c.href.includes("/api/checkout-processing"),
      );
      expect(checkoutCall).toBeDefined();

      const closeCall = fetchCalls.find((c) =>
        c.href.includes("/api/close-processing"),
      );
      expect(closeCall).toBeDefined();
      const payload = JSON.parse(String(closeCall?.options?.body));
      expect(payload).toMatchObject({
        calendarEventId: "cal-co-3",
        tenant: "itp",
      });
    });

    it("throws when XState transition fails", async () => {
      mockFetch.mockImplementation((url: any) => {
        const href = typeof url === "string" ? url : url.toString();
        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ error: "invalid state" }, false);
        }
        return makeResponse({});
      });

      const { checkOut } = await import("@/components/src/server/db");
      await expect(
        checkOut("cal-co-4", "admin@nyu.edu", "media_commons"),
      ).rejects.toThrow("XState checkout failed");
    });
  });

  describe("decline", () => {
    const makeResponse = (data: any, ok = true) =>
      ({
        ok,
        json: async () => data,
        text: async () => JSON.stringify(data),
      }) as Response;

    it("sends XState decline event and logs reason", async () => {
      mockShouldUseXState.mockReturnValue(true);

      const bookingLogPayloads: any[] = [];

      mockFetch.mockImplementation((url, options) => {
        const href = typeof url === "string" ? url : url.toString();
        const method = (options?.method ?? "GET").toUpperCase();

        if (href.includes("/api/xstate-transition")) {
          expect(method).toBe("POST");
          expect(options?.body).toContain('"eventType":"decline"');
          expect(options?.body).toContain('"reason":"Insufficient details"');
          return makeResponse({ newState: "Declined" });
        }

        if (href.includes("/api/booking-logs")) {
          if (method === "POST") {
            bookingLogPayloads.push(JSON.parse(options?.body ?? "{}"));
          }
          return makeResponse({});
        }

        throw new Error(`Unexpected fetch call in test: ${href}`);
      });

      const { decline } = await import("@/components/src/server/db");

      await decline(
        "cal-xyz",
        "admin@nyu.edu",
        "Insufficient details",
        "tenant-xyz",
      );

      expect(mockClientUpdateDataByCalendarEventId).not.toHaveBeenCalled();
      expect(bookingLogPayloads).toHaveLength(1);
      expect(bookingLogPayloads[0]).toMatchObject({
        calendarEventId: "cal-xyz",
        status: "DECLINED",
        changedBy: "admin@nyu.edu",
        note: "Insufficient details",
      });
    });

    it("falls back when XState decline fails and persists reason", async () => {
      mockShouldUseXState.mockReturnValue(true);

      const bookingLogPayloads: any[] = [];
      const fetchCalls: Array<{ href: string; options?: RequestInit }> = [];
      mockFetch.mockImplementation((url, options) => {
        const href = typeof url === "string" ? url : url.toString();
        const method = (options?.method ?? "GET").toUpperCase();
        fetchCalls.push({ href, options: options as RequestInit | undefined });

        if (href.includes("/api/xstate-transition")) {
          return makeResponse({ error: "boom" }, false);
        }

        if (href.includes("/api/booking-logs")) {
          if (method === "POST") {
            bookingLogPayloads.push(JSON.parse(options?.body ?? "{}"));
          }
          return makeResponse({});
        }

        return makeResponse({});
      });

      const { decline } = await import("@/components/src/server/db");

      await decline(
        "cal-abc",
        "admin@nyu.edu",
        "Not allowed",
        "tenant-abc",
      );

      // Allow asynchronous email/calendar operations to complete
      await Promise.resolve();
      await Promise.resolve();

      expect(mockClientUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        "bookings",
        "cal-abc",
        expect.objectContaining({
          declinedAt: expect.anything(),
          declinedBy: "admin@nyu.edu",
          declineReason: "Not allowed",
        }),
        "tenant-abc",
      );

      const logWithReason = bookingLogPayloads.find(
        (payload) => payload.note === "Not allowed",
      );
      expect(logWithReason).toMatchObject({
        status: "DECLINED",
        changedBy: "admin@nyu.edu",
      });

      const sendEmailCall = fetchCalls.find((call) =>
        call.href.includes("/api/sendEmail")
      );
      expect(sendEmailCall).toBeDefined();
      const sendEmailPayload = JSON.parse(
        String(sendEmailCall?.options?.body ?? "{}")
      );
      expect(sendEmailPayload).toMatchObject({
        targetEmail: "guest@nyu.edu",
        status: "DECLINED",
      });
      expect(sendEmailPayload.contents.headerMessage).toContain(
        "Declined message"
      );
      expect(sendEmailPayload.contents.headerMessage).toContain("Not allowed");

      const calendarCall = fetchCalls.find((call) =>
        call.href.includes("/api/calendarEvents")
      );
      expect(calendarCall).toBeDefined();
      const calendarPayload = JSON.parse(
        String(calendarCall?.options?.body ?? "{}")
      );
      expect(calendarPayload).toMatchObject({
        calendarEventId: "cal-abc",
        newValues: { statusPrefix: "DECLINED" },
      });
    });
  });
});
