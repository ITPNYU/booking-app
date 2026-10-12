import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import { clientApproveBooking } from "@/components/src/client/bookingActionClient";

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

  it("throws the server's error so the admin sees why approval fell short", async () => {
    const error =
      "Booking was approved, but a follow-up step failed: Google Calendar event title was not updated to [APPROVED] (calendar update returned 500)";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error }) }),
    );

    await expect(
      clientApproveBooking("calendar-1", "admin@nyu.edu", "mc"),
    ).rejects.toThrow(error);
  });
});
