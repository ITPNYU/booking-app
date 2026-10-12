import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import {
  ApprovedWithWarningError,
  clientApproveBooking,
} from "@/components/src/client/bookingActionClient";

describe("clientApproveBooking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves when the approval succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    await expect(
      clientApproveBooking("calendar-1", "admin@nyu.edu", "mc"),
    ).resolves.toBeUndefined();
  });

  it("throws ApprovedWithWarningError when the booking was approved but a follow-up failed", async () => {
    const error =
      "Booking was approved, but a follow-up step failed: Google Calendar event title was not updated to [APPROVED] (calendar update returned 500)";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error, approved: true }),
      }),
    );

    const result = clientApproveBooking("calendar-1", "admin@nyu.edu", "mc");
    await expect(result).rejects.toBeInstanceOf(ApprovedWithWarningError);
    await expect(result).rejects.toThrow(error);
  });

  it("throws a plain Error with the server's message when approval failed", async () => {
    const error = "You are not authorized to approve this booking";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error }) }),
    );

    const result = clientApproveBooking("calendar-1", "admin@nyu.edu", "mc");
    await expect(result).rejects.toThrow(error);
    await expect(result).rejects.not.toBeInstanceOf(ApprovedWithWarningError);
  });
});
