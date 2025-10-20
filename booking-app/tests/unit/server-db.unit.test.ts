import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClientFetchAllDataFromCollection = vi.fn();
const mockClientGetDataByCalendarEventId = vi.fn();
const mockClientSaveDataToFirestore = vi.fn();
const mockClientUpdateDataInFirestore = vi.fn();
const mockGetPaginatedData = vi.fn();
const mockClientUpdateDataByCalendarEventId = vi.fn();
const mockClientGetFinalApproverEmail = vi.fn();
const mockShouldUseXState = vi.fn();

const mockTimestampNow = vi.fn();
const mockWhere = vi.fn();

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
  },
  PagePermission: {
    ADMIN: "ADMIN",
    LIAISON: "LIAISON",
    PA: "PA",
    STUDENT: "STUDENT",
  },
}));

describe("server/db", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockTimestampNow.mockReturnValue("now");
    mockWhere.mockImplementation((field: string, operator: string, value: any) => ({
      field,
      operator,
      value,
    }));

    mockClientFetchAllDataFromCollection.mockResolvedValue([]);
    mockGetPaginatedData.mockResolvedValue([]);
    mockClientGetFinalApproverEmail.mockResolvedValue("final@nyu.edu");
    mockShouldUseXState.mockReturnValue(false);
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

    expect(mockWhere).toHaveBeenCalledWith("endDate", ">", "now");
    expect(mockClientFetchAllDataFromCollection).toHaveBeenCalledWith(
      "bookings",
      [expect.objectContaining({ field: "endDate", operator: ">" })],
      "tenant-1",
    );
    expect(result).toEqual([{ id: "booking" }]);
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
});
