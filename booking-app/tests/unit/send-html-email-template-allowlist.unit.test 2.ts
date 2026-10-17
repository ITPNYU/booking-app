import { beforeEach, describe, expect, it, vi } from "vitest";

const { readFileSync } = vi.hoisted(() => ({ readFileSync: vi.fn() }));
vi.mock("fs", () => ({ default: { readFileSync } }));
vi.mock("@/lib/firebase/server/adminDb", () => ({ getBookingLogs: vi.fn() }));
vi.mock("@/components/src/server/admin", () => ({ admins: vi.fn() }));
vi.mock("@/lib/googleClient", () => ({ getGmailClient: vi.fn() }));
vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn(),
}));

import { sendHTMLEmail } from "../../app/lib/sendHTMLEmail";

const baseParams = {
  contents: {},
  targetEmail: "someone@nyu.edu",
  status: "APPROVED",
  eventTitle: "Test",
  requestNumber: 1,
  body: "",
};

describe("sendHTMLEmail – template allowlist", () => {
  beforeEach(() => {
    readFileSync.mockReset();
  });

  it.each([
    "../../package.json",
    "../templates/booking_detail",
    "/etc/passwd",
    "booking_detail/../../package",
    "unknown_template",
    "",
  ])("rejects %j without touching the filesystem", async (templateName) => {
    await expect(
      sendHTMLEmail({ ...baseParams, templateName }),
    ).rejects.toThrow(/Unknown email template/);
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
