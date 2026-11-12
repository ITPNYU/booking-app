import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetFinalApproverEmail: vi.fn(),
  serverResolveResourceApproverEmails: vi.fn(),
}));

import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import {
  type BookingDecision,
  authorizeBookingDecision,
} from "@/lib/api/bookingDecisionAuthz";
import {
  serverGetFinalApproverEmail,
  serverResolveResourceApproverEmails,
} from "@/lib/firebase/server/adminDb";

const mockResolveCallerRole = vi.mocked(resolveCallerRole);
const mockServerGetFinalApproverEmail = vi.mocked(serverGetFinalApproverEmail);
const mockServerResolveResourceApproverEmails = vi.mocked(
  serverResolveResourceApproverEmails,
);

const EMAIL = "approver@nyu.edu";
const requested = { roomId: "room-1, room-2" };
const preApproved = {
  roomId: "room-1, room-2",
  firstApprovedAt: "2026-10-17T12:00:00Z",
};

const authorize = (
  booking: Record<string, unknown>,
  decision: BookingDecision,
) => authorizeBookingDecision(EMAIL, "itp", booking, decision);

describe("authorizeBookingDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
    mockServerGetFinalApproverEmail.mockResolvedValue(null as any);
    mockServerResolveResourceApproverEmails.mockResolvedValue([]);
  });

  describe.each<BookingDecision>(["approve", "decline"])("%s", (decision) => {
    it.each([PagePermission.ADMIN, PagePermission.SUPER_ADMIN])(
      "allows a %s at any stage",
      async (role) => {
        mockResolveCallerRole.mockResolvedValue(role);

        await expect(authorize(requested, decision)).resolves.toBe(true);
        await expect(authorize(preApproved, decision)).resolves.toBe(true);
      },
    );

    it("allows a liaison before the first approval", async () => {
      mockResolveCallerRole.mockResolvedValue(PagePermission.LIAISON);

      await expect(authorize(requested, decision)).resolves.toBe(true);
    });

    it("denies other users before the first approval, even resource approvers", async () => {
      mockServerResolveResourceApproverEmails.mockResolvedValue([EMAIL]);

      await expect(authorize(requested, decision)).resolves.toBe(false);
      expect(mockServerResolveResourceApproverEmails).not.toHaveBeenCalled();
    });

    it("allows the tenant final approver after the first approval", async () => {
      mockServerGetFinalApproverEmail.mockResolvedValue(` ${EMAIL.toUpperCase()} `);

      await expect(authorize(preApproved, decision)).resolves.toBe(true);
    });

    it("allows a resource approver of any booked room after the first approval", async () => {
      mockServerResolveResourceApproverEmails.mockResolvedValue([
        "other@nyu.edu",
        EMAIL,
      ]);

      await expect(authorize(preApproved, decision)).resolves.toBe(true);
      expect(mockServerResolveResourceApproverEmails).toHaveBeenCalledWith(
        ["room-1", "room-2"],
        "itp",
      );
    });

    it("denies someone who approves none of the booked rooms", async () => {
      mockServerResolveResourceApproverEmails.mockResolvedValue([
        "other@nyu.edu",
      ]);

      await expect(authorize(preApproved, decision)).resolves.toBe(false);
    });

    it("denies a booking with no rooms to anyone but the roles above", async () => {
      await expect(
        authorize({ firstApprovedAt: "2026-10-17T12:00:00Z" }, decision),
      ).resolves.toBe(false);
    });
  });

  it("lets a liaison decline after the first approval, as the liaison page offers", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.LIAISON);

    await expect(authorize(preApproved, "decline")).resolves.toBe(true);
  });

  it("does not let a liaison give the final approval", async () => {
    mockResolveCallerRole.mockResolvedValue(PagePermission.LIAISON);

    await expect(authorize(preApproved, "approve")).resolves.toBe(false);
  });
});
