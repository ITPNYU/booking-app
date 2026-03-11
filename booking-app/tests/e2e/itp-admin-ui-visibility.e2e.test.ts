import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "../../lib/firebase/stubs/firebaseFirestoreStub";
import {
  registerItpBookingMocks,
  mockItpTenantSchema,
} from "./helpers/itp-mock-routes";

const jsonHeaders = { "content-type": "application/json" };

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const ADMIN_EMAIL = "test@nyu.edu";

const ITP_BOOKING_ID = "mock-itp-booking";
const ITP_CALENDAR_ID = ITP_BOOKING_ID;

const USERS_RIGHTS_DOC_ID = "mock-itp-admin-rights";
const USERS_APPROVER_DOC_ID = "mock-itp-admin-approver";

const REQUEST_NUMBER = 20100;

const TIMESTAMP_FIELDS = [
  "startDate",
  "endDate",
  "requestedAt",
  "firstApprovedAt",
  "firstApprovedBy",
  "finalApprovedAt",
  "finalApprovedBy",
  "declinedAt",
  "declinedBy",
  "canceledAt",
  "canceledBy",
  "checkedInAt",
  "checkedInBy",
  "checkedOutAt",
  "checkedOutBy",
  "noShowedAt",
  "noShowedBy",
  "closedAt",
  "closedBy",
];

const createTimestamp = (date: Date) => {
  const ts = new Timestamp(date);
  (ts as any).toMillis = () => date.getTime();
  (ts as any).toJSON = () => date.toISOString();
  return ts;
};

async function seedItpAdminUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "itp-usersRights", USERS_RIGHTS_DOC_ID), {
    email: ADMIN_EMAIL,
    isAdmin: true,
    isWorker: false,
    isLiaison: false,
    isEquipment: false,
    isStaffing: false,
    isSetup: false,
    isCatering: false,
    isCleaning: false,
    isSecurity: false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc({} as any, "itp-usersApprovers", USERS_APPROVER_DOC_ID), {
    email: ADMIN_EMAIL,
    department: "ITP",
    level: 3,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedItpBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "itp-bookings", ITP_BOOKING_ID), {
    calendarEventId: ITP_CALENDAR_ID,
    requestNumber: REQUEST_NUMBER,
    email: "itpstudent@nyu.edu",
    firstName: "ITP",
    lastName: "Student",
    secondaryName: "",
    nNumber: "",
    netId: "itpstu",
    phoneNumber: "555-111-2222",
    department: "ITP / IMA / Low Res",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "",
    sponsorLastName: "",
    sponsorEmail: "",
    title: "ITP Admin UI Test Booking",
    description: "Booking seeded for ITP admin UI visibility tests.",
    bookingType: "",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "",
    equipmentServicesDetails: "",
    staffingServices: "",
    staffingServicesDetails: "",
    catering: "",
    cateringService: "",
    cleaningService: "",
    hireSecurity: "",
    expectedAttendance: "5",
    chartFieldForCatering: "",
    chartFieldForCleaning: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    missingEmail: "",
    startDate: createTimestamp(startDate),
    endDate: createTimestamp(endDate),
    requestedAt: createTimestamp(now),
    firstApprovedAt: createTimestamp(now),
    firstApprovedBy: "itpliaison@nyu.edu",
    finalApprovedAt: zeroTimestamp,
    finalApprovedBy: "",
    declinedAt: zeroTimestamp,
    declinedBy: "",
    declineReason: "",
    canceledAt: zeroTimestamp,
    canceledBy: "",
    checkedInAt: zeroTimestamp,
    checkedInBy: "",
    checkedOutAt: zeroTimestamp,
    checkedOutBy: "",
    noShowedAt: zeroTimestamp,
    noShowedBy: "",
    closedAt: zeroTimestamp,
    closedBy: "",
    walkedInAt: zeroTimestamp,
    origin: BookingOrigin.USER,
    status: BookingStatusLabel.PRE_APPROVED,
    equipmentCheckedOut: false,
    roomId: "408",
    selectedRooms: [
      {
        roomId: 408,
        name: "Room 408",
        calendarId: "mock-calendar-408",
        shouldAutoApprove: true,
        isEquipment: false,
      },
    ],
    departmentTier: "Tier 1",
    tenant: "itp",
    xstateData: {
      machineId: "itp-booking-machine-v5",
      lastTransition: "Pre-approved",
      snapshot: {
        value: "Pre-approved",
        status: BookingStatusLabel.PRE_APPROVED,
        context: {
          status: BookingStatusLabel.PRE_APPROVED,
          calendarEventId: ITP_CALENDAR_ID,
          servicesRequested: {},
          servicesApproved: {},
        },
      },
    },
  });
}

function serializeBookingRecord(record: any) {
  const serialized: Record<string, any> = { ...record };

  for (const field of TIMESTAMP_FIELDS) {
    const value = record[field];
    if (value && typeof value.toDate === "function") {
      serialized[field] = value.toDate().toISOString();
    }
  }

  if (record.startDate?.toDate) {
    serialized.startDate = record.startDate.toDate().toISOString();
  }
  if (record.endDate?.toDate) {
    serialized.endDate = record.endDate.toDate().toISOString();
  }
  if (record.requestedAt?.toDate) {
    serialized.requestedAt = record.requestedAt.toDate().toISOString();
  }

  serialized.xstateData = record.xstateData
    ? JSON.parse(JSON.stringify(record.xstateData))
    : undefined;

  return serialized;
}

async function registerItpMockBookingsFeed(page: Page) {
  const snapshot = await getDoc(
    doc({} as any, "itp-bookings", ITP_BOOKING_ID)
  );
  const baseData = snapshot.data();
  const basePayload = baseData
    ? {
        id: ITP_BOOKING_ID,
        calendarEventId: ITP_CALENDAR_ID,
        ...serializeBookingRecord(baseData),
      }
    : null;

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, "itp-bookings", ITP_BOOKING_ID)
    );
    const latestData = latestSnapshot.data();
    const payload = latestData
      ? [
          {
            id: ITP_BOOKING_ID,
            calendarEventId: ITP_CALENDAR_ID,
            ...serializeBookingRecord(latestData),
          },
        ]
      : [];

    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  });

  await page.addInitScript(
    ({ timestampFields, initialBooking, adminEmail }) => {
      const makeTimestamp = (value: string | null | undefined) => {
        if (!value) return null;
        const baseDate = new Date(value);
        return {
          toDate: () => new Date(baseDate),
          toMillis: () => baseDate.getTime(),
          valueOf: () => baseDate.getTime(),
        };
      };

      const enrichBooking = (raw: Record<string, any>) => {
        const booking = { ...raw };
        timestampFields.forEach((field: string) => {
          if (booking[field]) {
            booking[field] = makeTimestamp(booking[field]);
          } else if (
            booking[field] === null ||
            booking[field] === undefined
          ) {
            booking[field] = null;
          }
        });
        return booking;
      };

      async function loadBookings() {
        const response = await fetch("/api/__mock__/bookings");
        const raw = await response.json();
        const bookings = raw.map(enrichBooking);
        (window as any).__mockBookings = bookings;
        (window as any).__bookingE2EMocks = {
          bookings,
          usersRights: [
            {
              email: adminEmail,
              isAdmin: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          safetyTrainedUsers: [],
        };
        return bookings;
      }

      async function ensureBookings() {
        if (!(window as any).__mockBookings) {
          return await loadBookings();
        }
        return (window as any).__mockBookings;
      }

      (window as any).__refreshMockBookings = async () => {
        return await loadBookings();
      };

      const originalClientFetch =
        (window as any).clientFetchAllDataFromCollection;

      (window as any).clientFetchAllDataFromCollection = async function (
        tableName: string,
        constraints: unknown[],
        tenant: string
      ) {
        const normalizedTableName = tableName
          ? tableName.toLowerCase()
          : "";

        if (
          normalizedTableName.includes("booking") &&
          !normalizedTableName.includes("type")
        ) {
          return await ensureBookings();
        }

        if (originalClientFetch) {
          return await originalClientFetch(tableName, constraints, tenant);
        }

        return [];
      };

      const originalGetPaginatedData = (window as any).getPaginatedData;
      (window as any).getPaginatedData = async function (
        tableName: string,
        limit: number,
        filters: unknown,
        last: unknown,
        tenant: string
      ) {
        const normalizedTableName = tableName
          ? tableName.toLowerCase()
          : "";

        if (
          normalizedTableName.includes("booking") &&
          !normalizedTableName.includes("type")
        ) {
          return await ensureBookings();
        }

        if (originalGetPaginatedData) {
          return await originalGetPaginatedData(
            tableName,
            limit,
            filters,
            last,
            tenant
          );
        }

        return [];
      };

      if (initialBooking) {
        (window as any).__mockBookings = [enrichBooking(initialBooking)];
        (window as any).__bookingE2EMocks = {
          bookings: (window as any).__mockBookings,
          usersRights: [
            {
              email: adminEmail,
              isAdmin: true,
              createdAt: new Date().toISOString(),
            },
          ],
          usersApprovers: [
            {
              email: adminEmail,
              department: "ITP",
              level: 3,
              createdAt: new Date().toISOString(),
            },
          ],
          safetyTrainedUsers: [],
        };
      }
    },
    {
      timestampFields: TIMESTAMP_FIELDS,
      initialBooking: basePayload,
      adminEmail: ADMIN_EMAIL,
    }
  );
}

test.describe("ITP Admin UI – schema-driven visibility", () => {
  test.beforeEach(async ({ page }) => {
    await registerItpBookingMocks(page);

    await seedItpAdminUserData();
    await seedItpBooking();
    await registerItpMockBookingsFeed(page);
  });

  test("should not show Services column in ITP admin table", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/itp/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Wait for booking row to appear
    const bookingRow = page.locator(`[data-id="${ITP_CALENDAR_ID}"]`);
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Services column header should NOT be visible for ITP
    const servicesHeader = page.locator(
      '[role="columnheader"]'
    ).filter({ hasText: "Services" });
    await expect(servicesHeader).toHaveCount(0);
  });

  test("should not show Booking Type, Sponsor, or Services in detail modal for ITP", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/itp/admin`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Wait for booking row to appear
    const bookingRow = page.locator(`[data-id="${ITP_CALENDAR_ID}"]`);
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    // Click the "More" button to open detail modal
    const moreButton = bookingRow.locator('button:has(svg[data-testid="MoreHorizIcon"])');
    await moreButton.waitFor({ state: "visible", timeout: 5_000 });
    await moreButton.click();

    // Wait for modal to open — look for the Close button at the bottom
    const closeButton = page.getByRole("button", { name: "Close" });
    await closeButton.waitFor({ state: "visible", timeout: 5_000 });

    // Scope assertions to the MUI Modal's content area
    const modal = page.locator(".MuiModal-root");

    // Booking Type should NOT appear (showBookingTypes is false for ITP)
    await expect(modal.getByText("Booking Type", { exact: true })).toHaveCount(0);

    // Sponsor Name should NOT appear (showSponsor is false for ITP)
    await expect(modal.getByText("Sponsor Name", { exact: true })).toHaveCount(0);

    // Sponsor Email should NOT appear
    await expect(modal.getByText("Sponsor Email", { exact: true })).toHaveCount(0);

    // Services section should NOT appear — "Room Setup" and "Security" are always-rendered
    // children of the Services section, so their absence proves the section is hidden
    await expect(modal.getByText("Room Setup", { exact: true })).toHaveCount(0);
    await expect(modal.getByText("Security", { exact: true })).toHaveCount(0);

    // These fields SHOULD still appear for ITP
    await expect(modal.getByText("Title", { exact: true })).toHaveCount(1);
    await expect(modal.getByText("Description", { exact: true })).toHaveCount(1);
    await expect(modal.getByText("Expected Attendance", { exact: true })).toHaveCount(1);

    // Requester fields should still appear
    await expect(modal.getByText("Name", { exact: true })).toHaveCount(1);
    await expect(modal.getByText("Email", { exact: true })).toHaveCount(1);
  });
});
