import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverApproveBooking: vi.fn(),
  finalApprove: vi.fn(),
  serverFirstApproveOnly: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
}));

import { POST } from "@/app/api/approve/route";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import {
  finalApprove,
  serverApproveBooking,
  serverFirstApproveOnly,
} from "@/components/src/server/admin";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";

type MockRequestBody = {
  id: string;
  email: string;
};

const createRequest = (
  body: MockRequestBody,
  headers: Record<string, string> = {},
) => ({
  json: async () => body,
  headers: new Headers(headers),
});

const mockExecute = vi.mocked(executeXStateTransition);
const mockServerApproveBooking = vi.mocked(serverApproveBooking);
const mockFinalApprove = vi.mocked(finalApprove);
const mockServerFirstApproveOnly = vi.mocked(serverFirstApproveOnly);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);

const bookingId = "calendar-1";
const approverEmail = "approver@nyu.edu";

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

describe("POST /api/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      requestNumber: 42,
    } as any);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("falls back to serverApproveBooking when XState transition fails", async () => {
    mockExecute.mockResolvedValue({ success: false, error: "state error" });

    const response = await POST(
      createRequest(
        { id: bookingId, email: approverEmail },
        { "x-tenant": "tenant-a" },
      ) as any,
    );

    expect(mockExecute).toHaveBeenCalledWith(
      bookingId,
      "approve",
      "tenant-a",
      approverEmail,
    );
    expect(mockServerApproveBooking).toHaveBeenCalledWith(
      bookingId,
      approverEmail,
      "tenant-a",
    );
    expect(mockFinalApprove).not.toHaveBeenCalled();
    expect(mockServerFirstApproveOnly).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("runs finalApprove when XState reaches Approved", async () => {
    mockExecute.mockResolvedValue({ success: true, newState: "Approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: approverEmail }) as any,
    );

    expect(mockExecute).toHaveBeenCalledWith(
      bookingId,
      "approve",
      DEFAULT_TENANT,
      approverEmail,
    );
    expect(mockFinalApprove).toHaveBeenCalledWith(
      bookingId,
      approverEmail,
      DEFAULT_TENANT,
    );
    expect(mockServerApproveBooking).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("runs serverFirstApproveOnly when XState reaches Pre-approved", async () => {
    mockExecute.mockResolvedValue({ success: true, newState: "Pre-approved" });

    const response = await POST(
      createRequest({ id: bookingId, email: approverEmail }) as any,
    );

    expect(mockServerFirstApproveOnly).toHaveBeenCalledWith(
      bookingId,
      approverEmail,
      DEFAULT_TENANT,
    );
    expect(mockFinalApprove).not.toHaveBeenCalled();

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("logs services request transitions", async () => {
    mockExecute.mockResolvedValue({
      success: true,
      newState: { "Services Request": "pending" },
    });

    const response = await POST(
      createRequest(
        { id: bookingId, email: approverEmail },
        { "x-tenant": "tenant-b" },
      ) as any,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://booking.test/api/booking-logs",
      expect.objectContaining({ method: "POST" }),
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 200,
      data: { message: "Approved successfully" },
    });
  });

  it("propagates errors when approval fails", async () => {
    mockExecute.mockResolvedValue({ success: false, error: "state error" });
    mockServerApproveBooking.mockRejectedValue(new Error("Fallback failed"));

    const response = await POST(
      createRequest({ id: bookingId, email: approverEmail }) as any,
    );

    await expect(parseJson(response)).resolves.toEqual({
      status: 500,
      data: { error: "Fallback failed" },
    });
  });
});
