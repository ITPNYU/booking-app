import { expect, test } from "@playwright/test";
import { BookingTestHelper } from "./helpers/booking-test-helpers";
import { registerBookingMocks } from "./helpers/mock-routes";
import { MockServices } from "./helpers/mock-services";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Manual approval specific room selection (using room 230 instead of 202)
async function selectManualRoomAndTime(page) {
  const helper = new BookingTestHelper(page);
  await helper.selectRoomAndTime("230"); // Use room 230 for manual approval tests
}

test.describe("Manual Approval Booking Flow", () => {
  let services: MockServices;

  test.beforeEach(async ({ page }) => {
    services = new MockServices(page);
    await registerBookingMocks(page, {
      skipBookings: true,
      skipCalendar: true,
    });
    await services.enableAllMocks();
  });

  test.afterEach(() => {
    services.resetSideEffects();
  });

  test("should stay requested until approved and log side effects", async ({
    page,
  }) => {
    const helper = new BookingTestHelper(page);

    // Navigate to role selection page
    await helper.navigateToRoleSelection(BASE_URL);

    // Select department and role
    await helper.selectDropdown("Choose a Department", "ITP / IMA / Low Res");
    await helper.selectDropdown("Choose a Role", "Student");

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForURL("**/mc/book/selectRoom");

    // Select room and time
    await selectManualRoomAndTime(page);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForURL("**/mc/book/form");

    // Fill booking details
    const formData = {
      title: "Manual approval test",
      department: "ITP / IMA / Low Res",
      role: "Student",
      expectedAttendance: "12",
      description: "Manual approval end-to-end test",
      firstName: "Mary",
      lastName: "Jane",
      nNumber: "N87654321",
      netId: "mj4321",
      phoneNumber: "2125559876",
      sponsorFirstName: "Noah",
      sponsorLastName: "Pivnick",
      sponsorEmail: "noah.pivnick@nyu.edu",
      bookingType: "General Event",
      attendeeAffiliation: "NYU Members with an active NYU ID",
    };

    await helper.fillBookingDetails(formData);

    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByRole("heading", { name: /Yay! We've received your/i })
    ).toBeVisible();

    expect(services.getSideEffects("booking:update").length).toBe(0);
    expect(services.getSideEffects("calendar:create").length).toBe(0);
    expect(services.getSideEffects("history:record").length).toBe(0);

    const bookingCreateLogs = services.getSideEffects("booking:create");
    expect(bookingCreateLogs.length).toBeGreaterThan(0);
    const latestCreate = bookingCreateLogs[bookingCreateLogs.length - 1]
      ?.payload as
      | {
          request?: Record<string, unknown>;
          response?: { status?: string };
        }
      | undefined;
    expect(latestCreate?.response?.status).toBe("Requested");

    const requestBody = (latestCreate?.request ?? {}) as Record<
      string,
      unknown
    >;
    const requestFormData = (requestBody.data ?? {}) as Record<string, unknown>;
    const requesterEmail = requestBody.email as string | undefined;
    const sponsorEmail = requestFormData.sponsorEmail as string | undefined;

    const requestEmail = services
      .getSideEffects("email:send")
      .find((log) => (log.payload as any)?.status === "Requested");
    expect(requestEmail).toBeDefined();
    expect((requestEmail?.payload as any)?.recipients?.user).toBe(
      requesterEmail
    );

    services.approveLatestBooking();

    const approvedUpdate = await services.waitForSideEffect(
      (log) =>
        log.type === "booking:update" &&
        (log.payload as any)?.status === "Approved"
    );
    const approvedUpdatePayload = approvedUpdate.payload as any;
    expect(approvedUpdatePayload.bookingId).toBeTruthy();
    expect(approvedUpdatePayload.label).toBe("Approved");

    const calendarCreate = await services.waitForSideEffect(
      (log) => log.type === "calendar:create"
    );
    const calendarPayload = calendarCreate.payload as any;
    expect(calendarPayload.calendarEventId).toBeTruthy();
    expect(calendarPayload.title).toContain("[Approved]");

    const approvalEmail = await services.waitForSideEffect(
      (log) =>
        log.type === "email:send" && (log.payload as any)?.status === "Approved"
    );
    const approvalEmailPayload = approvalEmail.payload as any;
    expect(approvalEmailPayload.recipients?.user).toBe(requesterEmail);
    expect(approvalEmailPayload.recipients?.team).toBe(
      "media-commons-team@nyu.edu"
    );
    expect(approvalEmailPayload.recipients?.sponsor).toBe(sponsorEmail);
    expect(approvalEmailPayload.to).toEqual(
      expect.arrayContaining(
        [requesterEmail, "media-commons-team@nyu.edu", sponsorEmail].filter(
          Boolean
        )
      )
    );

    const historyRecord = await services.waitForSideEffect(
      (log) => log.type === "history:record"
    );
    const historyPayload = historyRecord.payload as any;
    expect(historyPayload.status).toBe("Approved");
    expect(historyPayload.label).toBe("Approved");
  });
});
