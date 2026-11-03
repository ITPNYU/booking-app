import { beforeEach, describe, expect, it, vi } from "vitest";

// Runs the real POST /api/approve fallback path (serverApproveBooking ->
// finalApprove -> serverApproveEvent) with Firestore, session and XState
// mocked, and the internal API calls answered by `mockFetch`.

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ts = (iso: string) => ({
  toDate: () => new Date(iso),
  toMillis: () => Date.parse(iso),
});

const booking = {
  id: "booking-doc",
  calendarEventId: "evt-1",
  requestNumber: 7073,
  title: "Follow-up failure",
  email: "requester@nyu.edu",
  secondaryEmail: "secondary@nyu.edu",
  role: "Faculty",
  roomId: "202",
  startDate: ts("2026-10-20T14:00:00.000Z"),
  endDate: ts("2026-10-20T16:00:00.000Z"),
  requestedAt: ts("2026-10-01T12:00:00.000Z"),
  firstApprovedAt: ts("2026-10-02T12:00:00.000Z"),
};

const mockUpdateInFirestore = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(async () => booking),
  serverGetDocumentById: vi.fn(async () => ({ resources: [] })),
  serverFetchAllDataFromCollection: vi.fn(async () => []),
  logServerBookingChange: vi.fn(async () => undefined),
  serverGetFinalApproverEmail: vi.fn(async () => "final@nyu.edu"),
  serverResolveResourceApproverEmails: vi.fn(async () => []),
  serverUpdateInFirestore: (...args: unknown[]) =>
    mockUpdateInFirestore(...args),
  serverDeleteData: vi.fn(),
  serverDeleteDocumentFields: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: vi.fn(async () => ({ email: "admin@nyu.edu" })),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: vi.fn(async () => "ADMIN"),
}));

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(async () => ({
    success: false,
    error: "Failed to restore XState actor from Firestore",
  })),
}));

import { POST } from "@/app/api/approve/route";

const ok = { ok: true, status: 200, json: async () => ({}) };
const failed = {
  ok: false,
  status: 500,
  statusText: "Internal Server Error",
  json: async () => ({}),
  text: async () => "",
};

const answer = (opts: {
  title: boolean;
  secondaryInvite: boolean;
  guestInvite?: boolean;
}) =>
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("/api/calendarEvents")) return opts.title ? ok : failed;
    if (url.endsWith("/api/inviteUser")) {
      const { guestEmail } = JSON.parse(init.body as string);
      if (guestEmail === "secondary@nyu.edu") {
        return opts.secondaryInvite ? ok : failed;
      }
      return opts.guestInvite === false ? failed : ok;
    }
    return ok;
  });

const approve = async () => {
  const response = await POST({
    json: async () => ({ id: "evt-1" }),
    headers: new Headers({ "x-tenant": "itp" }),
  } as any);
  return { status: response.status, body: await response.json() };
};

describe("POST /api/approve fallback follow-up failures", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpdateInFirestore.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("reports approved when the title update and the invite both fail", async () => {
    answer({ title: false, secondaryInvite: false });

    const { status, body } = await approve();

    expect(status).toBe(500);
    expect(body.approved).toBe(true);
    expect(body.error).toContain(
      "Google Calendar event title was not updated to [APPROVED]",
    );
    expect(body.error).toContain("Failed to invite secondary contact");
    expect(mockUpdateInFirestore).toHaveBeenCalledWith(
      expect.anything(),
      "booking-doc",
      expect.objectContaining({ finalApprovedBy: "admin@nyu.edu" }),
      "itp",
    );
  });

  it("reports approved when only the secondary invite fails", async () => {
    answer({ title: true, secondaryInvite: false });

    const { status, body } = await approve();

    expect(status).toBe(500);
    expect(body).toEqual({
      error: expect.stringMatching(
        /^Booking was approved, but a follow-up step failed: Failed to invite secondary contact/,
      ),
      approved: true,
    });
  });

  it("reports approved when only the requester invite fails", async () => {
    answer({ title: true, secondaryInvite: true, guestInvite: false });

    const { status, body } = await approve();

    expect(status).toBe(500);
    expect(body).toEqual({
      error: expect.stringMatching(
        /^Booking was approved, but a follow-up step failed: Failed to invite requester \(status 500/,
      ),
      approved: true,
    });
  });

  it("answers 200 when every step succeeds", async () => {
    answer({ title: true, secondaryInvite: true });

    await expect(approve()).resolves.toEqual({
      status: 200,
      body: { message: "Approved successfully" },
    });
  });
});
