import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAll: vi.fn(),
  getBooking: vi.fn(),
  resolveApprovers: vi.fn(),
  bookingContents: vi.fn(),
  emailConfig: vi.fn(),
  mediaCommonsServices: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverFetchAllDataFromCollection: mocks.fetchAll,
  serverGetDataByCalendarEventId: mocks.getBooking,
  serverResolveServiceApproverEmails: mocks.resolveApprovers,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mocks.bookingContents,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mocks.emailConfig,
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  getMediaCommonsServices: mocks.mediaCommonsServices,
}));

describe("notifyServiceApproversForRequestedServices", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({ ok: true });
    mocks.getBooking.mockResolvedValue({ roomId: "room-a" });
    mocks.bookingContents.mockResolvedValue({
      email: "requester@nyu.edu",
      requestNumber: "42",
      title: "Booking title",
    });
    mocks.emailConfig.mockResolvedValue({ schemaName: "Media Commons" });
    mocks.mediaCommonsServices.mockReturnValue({ setup: true });
  });

  it("notifies legacy service approvers when no resource-specific approver is assigned", async () => {
    mocks.resolveApprovers.mockResolvedValue([]);
    mocks.fetchAll.mockResolvedValue([
      { email: "setup@nyu.edu", isSetup: true },
      { email: "other@nyu.edu", isEquipment: true },
    ]);
    const { notifyServiceApproversForRequestedServices } =
      await import("@/components/src/server/serviceApproverNotifications");

    await notifyServiceApproversForRequestedServices("event-1", "mc");

    expect(mocks.fetchAll).toHaveBeenCalledWith("usersRights", [], "mc");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sendEmail"),
      expect.objectContaining({
        body: expect.stringContaining('"targetEmail":"setup@nyu.edu"'),
      }),
    );
  });

  it("falls back to legacy service approvers when a booking has no resource ID", async () => {
    mocks.getBooking.mockResolvedValue({});
    mocks.resolveApprovers.mockResolvedValue([]);
    mocks.fetchAll.mockResolvedValue([
      { email: "setup@nyu.edu", isSetup: true },
    ]);
    const { notifyServiceApproversForRequestedServices } =
      await import("@/components/src/server/serviceApproverNotifications");

    await notifyServiceApproversForRequestedServices("event-1", "mc");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/sendEmail"),
      expect.objectContaining({
        body: expect.stringContaining('"targetEmail":"setup@nyu.edu"'),
      }),
    );
  });
});
