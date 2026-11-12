import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Covers the traditional decline fallback route. The decline CC lookup runs
// through the real tenantPolicyServer against a mocked tenant schema.

const mocks = vi.hoisted(() => ({
  serverBookingContents: vi.fn(),
  serverSendBookingDetailEmail: vi.fn(),
  serverUpdateDataByCalendarEventId: vi.fn(),
  updateCalendarEvent: vi.fn(),
  getTenantEmailConfig: vi.fn(),
  logServerBookingChange: vi.fn(),
  serverGetDataByCalendarEventId: vi.fn(),
  serverGetDocumentById: vi.fn(),
  timestampNow: vi.fn(() => ({ seconds: 1, nanoseconds: 0 })),
  requireSession: vi.fn(),
  authorizeBookingDecision: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/api/bookingDecisionAuthz", () => ({
  authorizeBookingDecision: mocks.authorizeBookingDecision,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mocks.serverBookingContents,
  serverSendBookingDetailEmail: mocks.serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId: mocks.serverUpdateDataByCalendarEventId,
}));

vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: mocks.updateCalendarEvent,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mocks.getTenantEmailConfig,
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mocks.logServerBookingChange,
  serverGetDataByCalendarEventId: mocks.serverGetDataByCalendarEventId,
  serverGetDocumentById: mocks.serverGetDocumentById,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: mocks.timestampNow },
}));

import { POST } from "@/app/api/decline-processing/route";
import { BookingStatusLabel } from "@/components/src/types";

const GUEST_EMAIL = "guest@nyu.edu";
const DECLINE_CC_EMAIL = "ops@nyu.edu";

const createRequest = (body: Record<string, unknown>) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": "mc" }),
  }) as any;

const declineRequest = () =>
  createRequest({
    calendarEventId: "calendar-7780",
    email: "admin@nyu.edu",
    reason: "No staff available",
    tenant: "mc",
  });

const schemaWithDeclineCc = (production: string) => ({
  declinedGracePeriod: 24,
  ccEmails: {
    approved: { development: "", staging: "", production: "" },
    canceled: { development: "", staging: "", production: "" },
    declined: { development: "", staging: "", production },
  },
});

const sentEmails = () =>
  mocks.serverSendBookingDetailEmail.mock.calls.map(([options]) => options);

describe("POST /api/decline-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    mocks.serverGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-7780",
      requestNumber: 7780,
      email: GUEST_EMAIL,
    });
    mocks.getTenantEmailConfig.mockResolvedValue({
      schemaName: "Media Commons",
      emailNotifications: { declined: "Your request has been declined." },
    });
    mocks.serverGetDocumentById.mockResolvedValue(
      schemaWithDeclineCc(DECLINE_CC_EMAIL),
    );
    mocks.serverSendBookingDetailEmail.mockResolvedValue({ ok: true });
    mocks.serverBookingContents.mockResolvedValue({});
    mocks.requireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.authorizeBookingDecision.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the decline email to the requester and the decline CC address", async () => {
    const response = await POST(declineRequest());

    expect(response.status).toBe(200);
    const [guestEmail, ccEmail] = sentEmails();
    expect(sentEmails()).toHaveLength(2);
    expect(guestEmail).toMatchObject({
      calendarEventId: "calendar-7780",
      targetEmail: GUEST_EMAIL,
      status: BookingStatusLabel.DECLINED,
      tenant: "mc",
    });
    expect(guestEmail.headerMessage).toContain("No staff available");
    expect(ccEmail).toEqual({
      calendarEventId: "calendar-7780",
      targetEmail: DECLINE_CC_EMAIL,
      headerMessage: guestEmail.headerMessage,
      status: BookingStatusLabel.DECLINED,
      replyTo: GUEST_EMAIL,
      tenant: "mc",
    });
  });

  it("sends only the requester's email when no decline CC is configured", async () => {
    mocks.serverGetDocumentById.mockResolvedValue(schemaWithDeclineCc(""));

    await POST(declineRequest());

    expect(sentEmails().map((email) => email.targetEmail)).toEqual([
      GUEST_EMAIL,
    ]);
  });

  it("sends one email when the requester is the decline CC address", async () => {
    mocks.serverGetDocumentById.mockResolvedValue(
      schemaWithDeclineCc("Guest@NYU.edu"),
    );

    await POST(declineRequest());

    expect(sentEmails().map((email) => email.targetEmail)).toEqual([
      GUEST_EMAIL,
    ]);
  });

  it("still updates the calendar and succeeds when the CC email fails", async () => {
    mocks.serverSendBookingDetailEmail
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("gmail down"));

    const response = await POST(declineRequest());

    expect(response.status).toBe(200);
    expect(mocks.updateCalendarEvent).toHaveBeenCalledWith(
      "calendar-7780",
      { statusPrefix: BookingStatusLabel.DECLINED },
      {},
      "mc",
    );
  });

  it("sends one copy to each address in a CC list, skipping the requester", async () => {
    mocks.serverGetDocumentById.mockResolvedValue(
      schemaWithDeclineCc(
        "mediacommons.operations@nyu.edu; jhanele@nyu.edu, guest@nyu.edu",
      ),
    );

    await POST(declineRequest());

    const [guestEmail, ...ccEmails] = sentEmails();
    expect(ccEmails.map((email) => email.targetEmail)).toEqual([
      "mediacommons.operations@nyu.edu",
      "jhanele@nyu.edu",
    ]);
    ccEmails.forEach((email) => {
      expect(email).toMatchObject({
        headerMessage: guestEmail.headerMessage,
        replyTo: GUEST_EMAIL,
        status: BookingStatusLabel.DECLINED,
      });
    });
  });

  it("keeps sending to the other CC addresses and updates the calendar when one fails", async () => {
    mocks.serverGetDocumentById.mockResolvedValue(
      schemaWithDeclineCc("first@nyu.edu, second@nyu.edu"),
    );
    mocks.serverSendBookingDetailEmail.mockImplementation(
      async ({ targetEmail }: { targetEmail: string }) => {
        if (targetEmail === "first@nyu.edu") throw new Error("gmail down");
        return { ok: true };
      },
    );

    const response = await POST(declineRequest());

    expect(response.status).toBe(200);
    expect(sentEmails().map((email) => email.targetEmail)).toEqual([
      GUEST_EMAIL,
      "first@nyu.edu",
      "second@nyu.edu",
    ]);
    expect(mocks.updateCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated decline before reading the booking", async () => {
    mocks.requireSession.mockResolvedValue(null);

    const response = await POST(declineRequest());

    expect(response.status).toBe(401);
    expect(mocks.serverGetDataByCalendarEventId).not.toHaveBeenCalled();
    expect(mocks.serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
  });

  it("returns 403 without declining when the user is not an approver", async () => {
    mocks.authorizeBookingDecision.mockResolvedValue(false);

    const response = await POST(declineRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not authorized to decline this booking",
    });
    expect(mocks.authorizeBookingDecision).toHaveBeenCalledWith(
      "admin@nyu.edu",
      "mc",
      expect.objectContaining({ id: "booking-7780" }),
      "decline",
    );
    expect(mocks.serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    expect(sentEmails()).toHaveLength(0);
    expect(mocks.updateCalendarEvent).not.toHaveBeenCalled();
  });

  it("records the session user, not the email in the request body", async () => {
    mocks.requireSession.mockResolvedValue({
      email: "approver@nyu.edu",
      netId: "approver",
    });

    await POST(
      createRequest({
        calendarEventId: "calendar-7780",
        email: "someone-else@nyu.edu",
        reason: "No staff available",
        tenant: "mc",
      }),
    );

    expect(mocks.serverUpdateDataByCalendarEventId).toHaveBeenCalledWith(
      "bookings",
      "calendar-7780",
      expect.objectContaining({ declinedBy: "approver@nyu.edu" }),
      "mc",
    );
    expect(mocks.logServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({ changedBy: "approver@nyu.edu" }),
    );
  });
});
