import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/sendHTMLEmail", () => ({
  sendHTMLEmail: vi.fn(),
}));

import { POST } from "@/app/api/sendEmail/route";
import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";

const mockSendHTMLEmail = vi.mocked(sendHTMLEmail);

describe("POST /api/sendEmail", () => {
  const basePayload = {
    templateName: "booking-approved",
    contents: {
      calendarEventId: "event-123",
      startDate: "2024-09-01",
      endDate: "2024-09-02",
    },
    targetEmail: "requester@nyu.edu",
    status: "Approved",
    eventTitle: "Media Commons Session",
    requestNumber: 4567,
    bodyMessage: "All set!",
    approverType: "ADMIN",
    replyTo: "admin@nyu.edu",
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendHTMLEmail.mockResolvedValue(undefined);
  });

  it("calls sendHTMLEmail with the provided tenant and returns success", async () => {
    const request = {
      json: async () => basePayload,
      headers: new Headers({ "x-tenant": "tenant-media" }),
    } as any;

    const response = await POST(request);

    expect(mockSendHTMLEmail).toHaveBeenCalledWith({
      templateName: basePayload.templateName,
      contents: basePayload.contents,
      targetEmail: basePayload.targetEmail,
      status: basePayload.status,
      eventTitle: basePayload.eventTitle,
      requestNumber: basePayload.requestNumber,
      body: basePayload.bodyMessage,
      approverType: basePayload.approverType,
      replyTo: basePayload.replyTo,
      tenant: "tenant-media",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Email sent successfully",
    });
  });

  it("falls back to the default tenant and surfaces send errors", async () => {
    mockSendHTMLEmail.mockRejectedValueOnce(new Error("Gmail down"));

    const request = {
      json: async () => basePayload,
      headers: new Headers(),
    } as any;

    const response = await POST(request);

    expect(mockSendHTMLEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: DEFAULT_TENANT, body: basePayload.bodyMessage })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to send email",
    });
  });
});
