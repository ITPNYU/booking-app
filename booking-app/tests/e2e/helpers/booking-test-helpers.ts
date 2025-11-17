/**
 * Test utilities for XState approval flow e2e tests
 */

import { Page, expect } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
  role: "GENERAL" | "PA" | "LIAISON" | "ADMIN";
}

export interface BookingFormData {
  title: string;
  department: string;
  role: string;
  expectedAttendance: string;
  description: string;
  netId?: string; // For walk-in and VIP bookings
  firstName?: string;
  lastName?: string;
  nNumber?: string;
  phoneNumber?: string;
  sponsorFirstName?: string;
  sponsorLastName?: string;
  sponsorEmail?: string;
  bookingType?: string;
  attendeeAffiliation?: string;
}

export interface ServicesRequested {
  staff?: boolean;
  equipment?: boolean;
  catering?: boolean;
  cleaning?: boolean;
  security?: boolean;
  setup?: boolean;
}

export interface BookingOptions {
  isVip?: boolean;
  isWalkIn?: boolean;
  isModification?: boolean;
  servicesRequested?: ServicesRequested;
  shouldAutoApprove?: boolean;
}

export class BookingTestHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to role selection page with authentication bypass
   * This handles the common flow: /mc -> Request a Reservation -> I accept -> /mc/book/role
   */
  async navigateToRoleSelection(
    baseUrl: string = "http://localhost:3000"
  ): Promise<void> {
    await this.page.goto(`${baseUrl}/mc/book/role`, {
      waitUntil: "domcontentloaded",
    });
    await this.page.waitForLoadState("networkidle");

    // If we're redirected to the main MC page, go through the booking flow
    if (this.page.url().endsWith("/mc") || this.page.url().endsWith("/mc/")) {
      const requestButton = this.page.getByRole("button", {
        name: /Request a Reservation/i,
      });
      await requestButton.waitFor({ state: "visible", timeout: 15000 });
      await requestButton.click();

      await this.page.waitForURL("**/mc/book", { timeout: 15000 });
      const acceptButton = this.page.getByRole("button", {
        name: /^I accept$/i,
      });
      await acceptButton.waitFor({ state: "visible", timeout: 15000 });
      await acceptButton.click();

      await this.page.waitForURL("**/mc/book/role", { timeout: 15000 });
      await this.page.waitForLoadState("networkidle");
    }

    // Wait for department dropdown to be ready using data-testid
    const departmentLocator = this.page.getByTestId("department-select");
    await departmentLocator.waitFor({ state: "visible", timeout: 30000 });
  }

  /**
   * Select dropdown option using data-testid or fallback to text-based selector
   */
  async selectDropdown(label: string, optionText: string): Promise<void> {
    const DROPDOWN_TEST_IDS: Record<string, string> = {
      "Choose a Department": "department-select",
      "Choose a Role": "role-select",
      "Booking Type": "booking-type-select",
      "Attendee Affiliation(s)": "attendee-affiliation-select",
    };

    const DROPDOWN_OPTION_INDEX: Record<string, Record<string, number>> = {
      "Choose a Department": {
        "ITP / IMA / Low Res": 0,
        "General Department": 1,
      },
      "Choose a Role": {
        Student: 0,
        Faculty: 1,
        Staff: 2,
      },
      "Booking Type": {
        "Class Session": 0,
        "General Event": 1,
      },
      "Attendee Affiliation(s)": {
        "NYU Members with an active NYU ID": 0,
        "Non-NYU guests": 1,
        "All of the above": 2,
      },
    };

    const testId = DROPDOWN_TEST_IDS[label] ?? undefined;

    if (testId) {
      // Wait for dropdown to be visible and interactable
      const dropdown = this.page.getByTestId(testId);
      await dropdown.waitFor({ state: "visible", timeout: 30000 });
      await dropdown.click();
      await this.chooseOption(testId, optionText, DROPDOWN_OPTION_INDEX);
      return;
    }

    // Fallback to text-based selector with increased timeout
    const trigger = this.page.getByText(label, { exact: false }).first();
    await trigger.waitFor({ state: "visible", timeout: 30000 });
    await trigger.click();
    await this.chooseOption(undefined, optionText, DROPDOWN_OPTION_INDEX);
  }

  /**
   * Choose option from dropdown menu
   */
  private async chooseOption(
    menuTestId: string | undefined,
    optionText: string,
    optionIndex: Record<string, Record<string, number>>
  ): Promise<void> {
    if (menuTestId) {
      const menu = this.page.getByTestId(`${menuTestId}-menu`);
      await menu.waitFor({ state: "visible", timeout: 15000 });

      const labelFromTestId = (testId: string): string => {
        const DROPDOWN_TEST_IDS: Record<string, string> = {
          "Choose a Department": "department-select",
          "Choose a Role": "role-select",
          "Booking Type": "booking-type-select",
          "Attendee Affiliation(s)": "attendee-affiliation-select",
        };
        const entries = Object.entries(DROPDOWN_TEST_IDS);
        const found = entries.find(([, value]) => value === testId);
        return found ? found[0] : "";
      };

      const optionIdx = optionIndex[labelFromTestId(menuTestId)]?.[optionText];
      if (optionIdx != null) {
        await menu.getByTestId(`${menuTestId}-option-${optionIdx}`).click();
      } else {
        await menu
          .locator(`[data-testid^="${menuTestId}-option-"]`)
          .filter({ hasText: optionText })
          .first()
          .click();
      }
      await this.page.waitForTimeout(200);
      return;
    }

    const fallbackMenu = this.page
      .locator('li[role="option"]')
      .filter({ hasText: optionText })
      .first();
    await fallbackMenu.waitFor({ state: "visible", timeout: 15000 });
    await fallbackMenu.click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Select room and time slot using calendar interface
   */
  async selectRoomAndTime(roomId: string = "202"): Promise<void> {
    await this.page.getByTestId(`room-option-${roomId}`).check();

    const calendar = this.page.locator(
      '[data-testid="booking-calendar-wrapper"]'
    );
    await calendar.waitFor({ state: "visible", timeout: 15000 });

    // Pick a slot that starts one hour from "now" to keep the selection in the future.
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);

    const EARLIEST_HOUR = 9;
    const LATEST_START_HOUR = 21; // allows a one-hour block before closing
    let startHour = now.getHours();
    if (startHour < EARLIEST_HOUR) startHour = EARLIEST_HOUR;
    if (startHour > LATEST_START_HOUR) startHour = LATEST_START_HOUR;

    const endHour = startHour + 1;
    const formatHour = (hour: number) =>
      `${hour.toString().padStart(2, "0")}:00:00`;

    const findSlot = async (hour: number) => {
      const candidates = [
        `[data-resource-id="${roomId}"][data-time="${formatHour(hour)}"]`,
        `.fc-timegrid-slot.fc-timegrid-slot-lane[data-resource-id="${roomId}"][data-time="${formatHour(hour)}"]`,
        `.fc-timegrid-slot.fc-timegrid-slot-lane[data-time="${formatHour(hour)}"]`,
        `.fc-timegrid-slot.fc-timegrid-slot-lane[aria-label*="${hour % 12 === 0 ? 12 : hour % 12}"]`,
        `[data-time="${formatHour(hour)}"]`,
      ];

      for (const selector of candidates) {
        const slot = calendar.locator(selector).first();
        if ((await slot.count()) > 0) {
          return slot;
        }
      }
      return null;
    };

    const startSlot = await findSlot(startHour);
    const endSlot = await findSlot(endHour);

    if (!startSlot || !endSlot) {
      throw new Error(
        `Could not find time slots for range ${startHour}:00-${endHour}:00`
      );
    }

    await startSlot.scrollIntoViewIfNeeded();
    await endSlot.scrollIntoViewIfNeeded();

    const startBox = await startSlot.boundingBox();
    const endBox = await endSlot.boundingBox();

    if (!startBox || !endBox) {
      throw new Error("Unable to determine calendar slot positions");
    }

    const mouseX = startBox.x + startBox.width / 2;
    const startY = startBox.y + startBox.height / 2;
    const endY = endBox.y + endBox.height / 2;

    await this.page.mouse.move(mouseX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(mouseX, endY, { steps: 8 });
    await this.page.mouse.up();
  }

  /**
   * Fill booking form details
   */
  async fillBookingDetails(formData: BookingFormData): Promise<void> {
    await this.page
      .locator('input[name="firstName"]')
      .fill(formData.firstName || "Test");
    await this.page
      .locator('input[name="lastName"]')
      .fill(formData.lastName || "User");
    await this.page
      .locator('input[name="nNumber"]')
      .fill(formData.nNumber || "N12345678");
    await this.page
      .locator('input[name="netId"]')
      .fill(formData.netId || "testuser");
    await this.page
      .locator('input[name="phoneNumber"]')
      .fill(formData.phoneNumber || "2125551234");

    if (formData.sponsorFirstName) {
      await this.page
        .locator('input[name="sponsorFirstName"]')
        .fill(formData.sponsorFirstName);
    }
    if (formData.sponsorLastName) {
      await this.page
        .locator('input[name="sponsorLastName"]')
        .fill(formData.sponsorLastName);
    }
    if (formData.sponsorEmail) {
      await this.page
        .locator('input[name="sponsorEmail"]')
        .fill(formData.sponsorEmail);
    }

    await this.page.locator('input[name="title"]').fill(formData.title);
    await this.page
      .locator('input[name="description"]')
      .fill(formData.description);

    if (formData.bookingType) {
      await this.selectDropdown("Booking Type", formData.bookingType);
    }
    await this.page
      .locator('input[name="expectedAttendance"]')
      .fill(formData.expectedAttendance);

    if (formData.attendeeAffiliation) {
      await this.selectDropdown(
        "Attendee Affiliation(s)",
        formData.attendeeAffiliation
      );
    }

    // Check required agreements
    await this.page.locator("#checklist").check();
    await this.page.locator("#resetRoom").check();
    await this.page.locator("#bookingPolicy").check();
  }

  async loginUser(user: TestUser): Promise<void> {
    // With authentication bypass enabled, we don't need to go through login flow
    // Just verify that the auth bypass is working
    console.log(
      `🎯 Setting up user context for ${user.role} user with authentication bypass...`
    );

    // Verify authentication bypass is working by checking the test environment endpoint
    const response = await this.page.request.get(
      "http://localhost:3000/api/isTestEnv"
    );
    if (!response.ok()) {
      throw new Error(
        "Authentication bypass verification failed - test environment not accessible"
      );
    }

    const authData = await response.json();
    if (!authData.isOnTestEnv) {
      throw new Error(
        "Authentication bypass not enabled - BYPASS_AUTH environment variable not working"
      );
    }

    console.log(
      "✅ Authentication bypass confirmed - proceeding without login flow"
    );
  }

  async navigateToMCTenant(): Promise<void> {
    // Navigate directly to media-commons tenant (using the standard path from working tests)
    await this.page.goto("http://localhost:3000/media-commons");
    await this.page.waitForLoadState("networkidle");

    // Verify we're not redirected to signin (indicates auth bypass is working)
    const currentUrl = this.page.url();
    if (currentUrl.includes("/signin")) {
      throw new Error(
        "Authentication bypass failed - redirected to signin page"
      );
    }

    console.log("✅ Successfully navigated to MC tenant with auth bypass");
  }

  async startBookingProcess(options: BookingOptions = {}): Promise<void> {
    if (options.isWalkIn) {
      await this.page
        .getByRole("button", { name: "Walk-in Booking" })
        .waitFor({ state: "visible" });
      await this.page.getByRole("button", { name: "Walk-in Booking" }).click();
    } else if (options.isVip) {
      await this.page
        .getByRole("button", { name: "VIP Booking" })
        .waitFor({ state: "visible" });
      await this.page.getByRole("button", { name: "VIP Booking" }).click();
    } else {
      await this.page
        .getByRole("button", { name: "Request a Reservation" })
        .waitFor({ state: "visible" });
      await this.page
        .getByRole("button", { name: "Request a Reservation" })
        .click();
    }

    // Accept terms
    await this.page
      .getByRole("button", { name: "I accept" })
      .waitFor({ state: "visible" });
    await this.page.getByRole("button", { name: "I accept" }).click();

    const currentUrl = this.page.url();
    if (!/\/mc\/(walk-in\/|vip\/)?book\/role$/.test(currentUrl)) {
      if (currentUrl.endsWith("/mc") || currentUrl.endsWith("/mc/")) {
        await this.page
          .getByRole("button", { name: /Request a Reservation/i })
          .click();
        await this.page.getByRole("button", { name: /I accept/i }).click();
      } else if (currentUrl.includes("/signin")) {
        await this.page.waitForURL(/\/mc(\/book\/role)?$/);
        if (
          this.page.url().endsWith("/mc") ||
          this.page.url().endsWith("/mc/")
        ) {
          await this.page
            .getByRole("button", { name: /Request a Reservation/i })
            .click();
          await this.page.getByRole("button", { name: /I accept/i }).click();
        }
      }
    }

    await this.page.waitForURL(/\/mc\/(walk-in\/|vip\/)?book\/role$/);
  }

  async fillBasicBookingForm(formData: BookingFormData): Promise<void> {
    const selectDropdownOption = async (
      testId: string,
      optionText: string,
      fallbackLabel?: string
    ) => {
      // Try data-testid first (more stable)
      let trigger = this.page.getByTestId(testId);

      // Wait for the element to be visible and interactable
      await trigger.waitFor({ state: "visible", timeout: 30000 });
      await trigger.click();

      // Wait for dropdown menu to appear and select option
      const option = this.page.getByRole("option", { name: optionText });
      await option.waitFor({ state: "visible", timeout: 15000 });
      await option.click();
    };

    // Department selection
    await selectDropdownOption(
      "department-select",
      formData.department,
      "Choose a Department"
    );

    // Role selection
    await selectDropdownOption("role-select", formData.role, "Choose a Role");

    // Title
    await this.page
      .locator('input[name="title"]')
      .waitFor({ state: "visible" });
    await this.page.locator('input[name="title"]').fill(formData.title);

    // Description
    await this.page
      .locator('textarea[name="description"]')
      .waitFor({ state: "visible" });
    await this.page
      .locator('textarea[name="description"]')
      .fill(formData.description);

    // NetId for walk-in/VIP bookings
    if (formData.netId) {
      await this.page
        .locator('input[name="netId"]')
        .waitFor({ state: "visible" });
      await this.page.locator('input[name="netId"]').fill(formData.netId);
    }

    await this.page
      .getByRole("button", { name: "Next" })
      .waitFor({ state: "visible" });
    await this.page.getByRole("button", { name: "Next" }).click();
  }

  async selectFirstAvailableRoomAndTime(): Promise<void> {
    await this.page.waitForURL(/selectRoom/);
    // Select first available room
    const roomSelector = this.page
      .locator('[data-testid^="room-option-"]')
      .first();
    if ((await roomSelector.count()) > 0) {
      await roomSelector.click();
    } else {
      // Fallback to first checkbox
      await this.page.getByRole("checkbox").first().check();
    }

    // Select tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const dateInput = this.page.locator('input[type="date"]');
    if ((await dateInput.count()) > 0) {
      await dateInput.fill(dateStr);
    }

    // Select time slot (default to morning slot)
    const calendar = this.page.locator(
      '[data-testid="booking-calendar-wrapper"]'
    );
    if ((await calendar.count()) > 0) {
      const boundingBox = await calendar.boundingBox();
      if (boundingBox) {
        const { x, y, width, height } = boundingBox;
        const startX = x + width * 0.2;
        const startY = y + height * 0.3;
        const endY = startY + height * 0.1;
        await this.page.mouse.move(startX, startY);
        await this.page.mouse.down();
        await this.page.mouse.move(startX, endY, { steps: 10 });
        await this.page.mouse.up();
      }
    }

    await this.page
      .getByRole("button", { name: "Next" })
      .waitFor({ state: "visible" });
    await this.page.getByRole("button", { name: "Next" }).click();
  }

  async fillEventDetails(formData: BookingFormData): Promise<void> {
    await this.page.waitForURL(/details/);
    // Expected attendance
    await this.page
      .locator('input[name="expectedAttendance"]')
      .waitFor({ state: "visible" });
    await this.page
      .locator('input[name="expectedAttendance"]')
      .fill(formData.expectedAttendance);

    // Access type
    await this.page
      .getByLabel("Select an option")
      .waitFor({ state: "visible" });
    await this.page.getByLabel("Select an option").click();
    await this.page
      .getByRole("option", { name: "NYU Members with an active" })
      .waitFor({ state: "visible" });
    await this.page
      .getByRole("option", { name: "NYU Members with an active" })
      .click();
  }

  async selectServices(services: ServicesRequested): Promise<void> {
    if (services.staff) {
      await this.page.locator('#services-staff, input[name*="staff"]').check();
    }
    if (services.equipment) {
      await this.page
        .locator('#services-equipment, input[name*="equipment"]')
        .check();
    }
    if (services.catering) {
      await this.page
        .locator('#services-catering, input[name*="catering"]')
        .check();
    }
    if (services.cleaning) {
      await this.page
        .locator('#services-cleaning, input[name*="cleaning"]')
        .check();
    }
    if (services.security) {
      await this.page
        .locator('#services-security, input[name*="security"]')
        .check();
    }
    if (services.setup) {
      await this.page.locator('#services-setup, input[name*="setup"]').check();
    }
  }

  async acceptRequiredTerms(): Promise<void> {
    // Accept all required checkboxes
    await this.page.locator("#checklist").check();
    await this.page.locator("#resetRoom").check();
    await this.page.locator("#bookingPolicy").check();
  }

  async submitBooking(): Promise<void> {
    await this.page.getByRole("button", { name: "Submit" }).click();
    await this.page.waitForSelector("h6", { timeout: 30000 });
  }

  async createCompleteBooking(
    formData: BookingFormData,
    options: BookingOptions = {}
  ): Promise<void> {
    await this.startBookingProcess(options);
    await this.fillBasicBookingForm(formData);
    await this.selectFirstAvailableRoomAndTime();
    await this.fillEventDetails(formData);

    if (options.servicesRequested) {
      await this.selectServices(options.servicesRequested);
    }

    await this.acceptRequiredTerms();
    await this.submitBooking();
  }

  async getBookingStatus(bookingId?: string): Promise<string> {
    // Navigate to admin panel
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    // Get status of the latest booking or specific booking
    let statusElement;
    if (bookingId) {
      statusElement = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="booking-status"]`
      );
    } else {
      statusElement = this.page
        .locator('[data-testid="booking-status"]')
        .first();
    }

    if ((await statusElement.count()) > 0) {
      return (await statusElement.textContent()) || "Unknown";
    }

    // Fallback: look for status in table
    const statusCell = this.page.locator('table td:has-text("Status")').first();
    if ((await statusCell.count()) > 0) {
      return (await statusCell.textContent()) || "Unknown";
    }

    return "Status not found";
  }

  async approveBooking(bookingId?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let approveButton;
    if (bookingId) {
      approveButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="approve-booking"]`
      );
    } else {
      approveButton = this.page
        .locator('[data-testid="approve-booking"]')
        .first();
    }

    await approveButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async declineBooking(
    bookingId?: string,
    reason: string = "Test decline"
  ): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let declineButton;
    if (bookingId) {
      declineButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="decline-booking"]`
      );
    } else {
      declineButton = this.page
        .locator('[data-testid="decline-booking"]')
        .first();
    }

    await declineButton.click();
    await this.page.locator('textarea[name="reason"]').fill(reason);
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async approveService(
    serviceType: keyof ServicesRequested,
    bookingId?: string
  ): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let serviceButton;
    if (bookingId) {
      serviceButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="approve-${serviceType}-service"]`
      );
    } else {
      serviceButton = this.page
        .locator(`[data-testid="approve-${serviceType}-service"]`)
        .first();
    }

    await serviceButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async declineService(
    serviceType: keyof ServicesRequested,
    bookingId?: string,
    reason: string = "Test decline"
  ): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let serviceButton;
    if (bookingId) {
      serviceButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="decline-${serviceType}-service"]`
      );
    } else {
      serviceButton = this.page
        .locator(`[data-testid="decline-${serviceType}-service"]`)
        .first();
    }

    await serviceButton.click();
    await this.page.locator('textarea[name="reason"]').fill(reason);
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async checkInBooking(bookingId?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let checkInButton;
    if (bookingId) {
      checkInButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="check-in-booking"]`
      );
    } else {
      checkInButton = this.page
        .locator('[data-testid="check-in-booking"]')
        .first();
    }

    await checkInButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async checkOutBooking(bookingId?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let checkOutButton;
    if (bookingId) {
      checkOutButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="check-out-booking"]`
      );
    } else {
      checkOutButton = this.page
        .locator('[data-testid="check-out-booking"]')
        .first();
    }

    await checkOutButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async markNoShow(bookingId?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let noShowButton;
    if (bookingId) {
      noShowButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="no-show-booking"]`
      );
    } else {
      noShowButton = this.page
        .locator('[data-testid="no-show-booking"]')
        .first();
    }

    await noShowButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async cancelBooking(bookingId?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let cancelButton;
    if (bookingId) {
      cancelButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="cancel-booking"]`
      );
    } else {
      cancelButton = this.page
        .locator('[data-testid="cancel-booking"]')
        .first();
    }

    await cancelButton.click();
    await this.page.getByRole("button", { name: "Confirm" }).click();
  }

  async editBooking(bookingId?: string, newTitle?: string): Promise<void> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let editButton;
    if (bookingId) {
      editButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="edit-booking"]`
      );
    } else {
      editButton = this.page.locator('[data-testid="edit-booking"]').first();
    }

    await editButton.click();

    if (newTitle) {
      await this.page.locator('input[name="title"]').fill(newTitle);
    }

    await this.page.getByRole("button", { name: "Update" }).click();
  }

  async viewBookingHistory(bookingId?: string): Promise<string[]> {
    await this.page.goto("http://localhost:3000/mc/admin/");
    await this.page.waitForLoadState("networkidle");

    let historyButton;
    if (bookingId) {
      historyButton = this.page.locator(
        `[data-booking-id="${bookingId}"] [data-testid="view-history"]`
      );
    } else {
      historyButton = this.page.locator('[data-testid="view-history"]').first();
    }

    await historyButton.click();

    const historyEntries = await this.page
      .locator('[data-testid="history-entry"]')
      .allTextContents();
    return historyEntries;
  }

  async assertBookingStatus(
    expectedStatus: string,
    bookingId?: string
  ): Promise<void> {
    const actualStatus = await this.getBookingStatus(bookingId);
    expect(actualStatus).toContain(expectedStatus);
  }

  async assertSuccessMessage(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Yay! We've received your" })
    ).toBeVisible();
  }

  async assertErrorMessage(): Promise<void> {
    await expect(this.page.getByRole("alert")).toBeVisible();
  }

  async waitForStateTransition(timeoutMs: number = 5000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
  }
}

// Test data factory
export class TestDataFactory {
  static createStandardBooking(): BookingFormData {
    return {
      title: "Test Standard Booking",
      department: "ITP / IMA / Low Res",
      role: "Student",
      expectedAttendance: "15",
      description: "Standard booking for testing XState flow",
    };
  }

  static createVipBooking(): BookingFormData {
    return {
      title: "Test VIP Booking",
      department: "ITP / IMA / Low Res",
      role: "Faculty",
      expectedAttendance: "25",
      description: "VIP booking for testing XState flow",
    };
  }

  static createWalkInBooking(): BookingFormData {
    return {
      title: "Test Walk-in Booking",
      department: "ITP / IMA / Low Res",
      role: "Student",
      expectedAttendance: "10",
      description: "Walk-in booking for testing XState flow",
      netId: "testuser",
    };
  }

  static createServicesRequested(
    services: Partial<ServicesRequested> = {}
  ): ServicesRequested {
    return {
      staff: false,
      equipment: false,
      catering: false,
      cleaning: false,
      security: false,
      setup: false,
      ...services,
    };
  }
}

// Test users factory
export class TestUsersFactory {
  static getGeneralUser(): TestUser {
    return {
      email: process.env.TEST_GENERAL_USER_EMAIL || "test@nyu.edu",
      password: process.env.TEST_GENERAL_USER_PASSWORD || "password",
      role: "GENERAL",
    };
  }

  static getPAUser(): TestUser {
    return {
      email: process.env.TEST_PA_USER_EMAIL || "pa@nyu.edu",
      password: process.env.TEST_PA_USER_PASSWORD || "password",
      role: "PA",
    };
  }

  static getLiaisonUser(): TestUser {
    return {
      email: process.env.TEST_LIAISON_USER_EMAIL || "liaison@nyu.edu",
      password: process.env.TEST_LIAISON_USER_PASSWORD || "password",
      role: "LIAISON",
    };
  }

  static getAdminUser(): TestUser {
    return {
      email: process.env.TEST_ADMIN_USER_EMAIL || "admin@nyu.edu",
      password: process.env.TEST_ADMIN_USER_PASSWORD || "password",
      role: "ADMIN",
    };
  }
}
