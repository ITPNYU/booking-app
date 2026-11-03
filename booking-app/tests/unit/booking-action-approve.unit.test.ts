import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import {
  ApprovedWithWarningError,
  NotAnApproverError,
  clientApproveBooking,
  decline,
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
    const error =
      "This request is in the services approval flow. Complete or decline each service request before final approval, or refresh the page.";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 409, json: async () => ({ error }) }),
    );

    const result = clientApproveBooking("calendar-1", "admin@nyu.edu", "mc");
    await expect(result).rejects.toThrow(error);
    await expect(result).rejects.not.toBeInstanceOf(ApprovedWithWarningError);
    await expect(result).rejects.not.toBeInstanceOf(NotAnApproverError);
  });

  it("throws NotAnApproverError when the server refuses the caller (403)", async () => {
    const error = "You are not authorized to approve this booking";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, json: async () => ({ error }) }),
    );

    const result = clientApproveBooking("calendar-1", "approver@nyu.edu", "itp");
    await expect(result).rejects.toBeInstanceOf(NotAnApproverError);
    await expect(result).rejects.toThrow(error);
  });
});

describe("decline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const response = (status: number, body: Record<string, unknown>) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  const calledUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url]) => String(url));

  it("resolves when the XState decline succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { success: true, newState: "Declined" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      decline("calendar-1", "approver@nyu.edu", "No staff", "itp"),
    ).resolves.toBeUndefined();
    expect(calledUrls(fetchMock)).toEqual([
      expect.stringContaining("/api/xstate-transition"),
    ]);
  });

  it("throws NotAnApproverError on a 403 without trying the fallback", async () => {
    const error = "You are not authorized to decline this booking";
    const fetchMock = vi.fn().mockResolvedValue(response(403, { error }));
    vi.stubGlobal("fetch", fetchMock);

    const result = decline("calendar-1", "approver@nyu.edu", "No staff", "itp");
    await expect(result).rejects.toBeInstanceOf(NotAnApproverError);
    await expect(result).rejects.toThrow(error);
    expect(calledUrls(fetchMock)).toEqual([
      expect.stringContaining("/api/xstate-transition"),
    ]);
  });

  it("throws on a 401 without trying the fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(401, { error: "Unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      decline("calendar-1", "approver@nyu.edu", "No staff", "itp"),
    ).rejects.toThrow("Unauthorized");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to decline-processing when the XState decline fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(400, { error: "Transition not allowed" }))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      decline("calendar-1", "admin@nyu.edu", "No staff", "itp"),
    ).resolves.toBeUndefined();
    expect(calledUrls(fetchMock)).toEqual([
      expect.stringContaining("/api/xstate-transition"),
      expect.stringContaining("/api/decline-processing"),
    ]);
  });

  it("throws NotAnApproverError when the fallback refuses the caller", async () => {
    const error = "You are not authorized to decline this booking";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(400, { error: "Transition not allowed" }))
        .mockResolvedValueOnce(response(403, { error })),
    );

    await expect(
      decline("calendar-1", "approver@nyu.edu", "No staff", "itp"),
    ).rejects.toBeInstanceOf(NotAnApproverError);
  });

  it("throws the server's message when the fallback fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(400, { error: "Transition not allowed" }))
        .mockResolvedValueOnce(
          response(500, { success: false, error: "Booking not found" }),
        ),
    );

    const result = decline("calendar-1", "admin@nyu.edu", "No staff", "itp");
    await expect(result).rejects.toThrow("Booking not found");
    await expect(result).rejects.not.toBeInstanceOf(NotAnApproverError);
  });
});
