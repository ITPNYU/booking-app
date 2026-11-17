import { beforeEach, describe, expect, it, vi } from "vitest";

// sendHTMLEmail loads Handlebars only on the server (no window), so hide
// jsdom's window while the module loads, then put it back.
const realWindow = vi.hoisted(() => {
  const saved = globalThis.window;
  (globalThis as any).window = undefined;
  return saved;
});

const send = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  getBookingLogs: vi.fn(async () => []),
}));
vi.mock("@/components/src/server/admin", () => ({
  admins: vi.fn(async () => []),
}));
vi.mock("@/lib/googleClient", () => ({
  getGmailClient: vi.fn(async () => ({ users: { messages: { send } } })),
}));
vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn(async () => []),
}));

import { sendHTMLEmail } from "../../app/lib/sendHTMLEmail";

(globalThis as any).window = realWindow;

/** The HTML body of the email last handed to Gmail. */
const sentHtml = () => {
  const raw: string = send.mock.calls.at(-1)?.[0].requestBody.raw;
  const message = Buffer.from(
    raw.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
  return message.slice(message.indexOf("\n\n") + 2);
};

const sendDetailEmail = (contents: Record<string, unknown>) =>
  sendHTMLEmail({
    templateName: "booking_detail",
    contents: {
      requestNumber: 42,
      roomId: "202",
      startDate: "2026-11-09",
      title: "Showcase",
      bookingType: "Workshop",
      ...contents,
    },
    targetEmail: "someone@nyu.edu",
    status: "REQUESTED",
    eventTitle: "Showcase",
    requestNumber: 42,
    body: "",
    tenant: "mc",
  });

describe("department collaboration in the booking email (#1383)", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("lists the collaborating departments, naming Other", async () => {
    await sendDetailEmail({
      departmentCollaboration: "Yes",
      collaboratingDepartments: ["IDM", "Other"],
      otherCollaboratingDepartments: "Tisch Drama",
    });

    const html = sentHtml();
    expect(html).toContain("Department Collaboration");
    expect(html).toContain("Yes: IDM, Other (Tisch Drama)");
  });

  it("shows a No answer as No", async () => {
    await sendDetailEmail({ departmentCollaboration: "No" });

    expect(sentHtml()).toMatch(/Department Collaboration<\/td>\s*<td>No<\/td>/);
  });

  it("leaves the row out for bookings that were never asked", async () => {
    await sendDetailEmail({});

    expect(sentHtml()).not.toContain("Department Collaboration");
  });
});
