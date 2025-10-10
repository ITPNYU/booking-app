import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/server/db", () => ({
  processCloseBooking: vi.fn(),
}));

import { POST } from "@/app/api/close-processing/route";
import { processCloseBooking } from "@/components/src/server/db";

const mockProcessCloseBooking = vi.mocked(processCloseBooking);

const createRequest = (body: any) => ({
  json: async () => body,
});

describe("POST /api/close-processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully processes close booking with all required fields", async () => {
    mockProcessCloseBooking.mockResolvedValue(undefined);

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(mockProcessCloseBooking).toHaveBeenCalledWith(
      "event-123",
      "admin@nyu.edu",
      "media-commons",
    );
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 400 when calendarEventId is missing", async () => {
    const requestBody = {
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
    expect(mockProcessCloseBooking).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
    expect(mockProcessCloseBooking).not.toHaveBeenCalled();
  });

  it("returns 400 when tenant is missing", async () => {
    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
    expect(mockProcessCloseBooking).not.toHaveBeenCalled();
  });

  it("returns 500 when close processing fails", async () => {
    mockProcessCloseBooking.mockRejectedValue(
      new Error("Close processing failed"),
    );

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Close processing failed");
  });

  it("handles database errors gracefully", async () => {
    mockProcessCloseBooking.mockRejectedValue(new Error("Database timeout"));

    const requestBody = {
      calendarEventId: "event-123",
      email: "admin@nyu.edu",
      tenant: "media-commons",
    };

    const response = await POST(createRequest(requestBody) as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database timeout");
  });
});
