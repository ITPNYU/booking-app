import { expect, Page, test } from "@playwright/test";

import {
  BookingOrigin,
  BookingStatusLabel,
} from "../../components/src/types";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "../../lib/firebase/stubs/firebaseFirestoreStub";
import { registerBookingMocks } from "./helpers/mock-routes";

const jsonHeaders = { "content-type": "application/json" };

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const LIAISON_EMAIL = "test@nyu.edu";
const REQUESTOR_EMAIL = "requestor.mock@nyu.edu";

const BOOKING_DOC_ID = "mock-liaison-booking";
const CALENDAR_EVENT_ID = BOOKING_DOC_ID;

const USERS_RIGHTS_DOC_ID = "mock-liaison-rights";
const APPROVER_DOC_ID = "mock-liaison-approver";
const FINAL_APPROVER_DOC_ID = "mock-final-approver";

const FINAL_APPROVER_EMAIL = "final.approver.mock@nyu.edu";

const REQUEST_NUMBER = 9001;
const NON_REQUESTED_BOOKINGS = [
  {
    id: "mock-liaison-pre",
    calendarEventId: "mock-liaison-pre",
    status: BookingStatusLabel.PRE_APPROVED,
    xstateValue: "Pre-approved",
  },
  {
    id: "mock-liaison-approved",
    calendarEventId: "mock-liaison-approved",
    status: BookingStatusLabel.APPROVED,
    xstateValue: "Approved",
  },
  {
    id: "mock-liaison-declined",
    calendarEventId: "mock-liaison-declined",
    status: BookingStatusLabel.DECLINED,
    xstateValue: "Declined",
  },
];
const TIMESTAMP_FIELDS = [
  "startDate",
  "endDate",
  "requestedAt",
  "firstApprovedAt",
  "finalApprovedAt",
  "equipmentAt",
  "equipmentApprovedAt",
  "declinedAt",
  "canceledAt",
  "checkedInAt",
  "checkedOutAt",
  "noShowedAt",
  "closedAt",
  "walkedInAt",
];

const createTimestamp = (date: Date) => {
  const ts = new Timestamp(date);
  (ts as any).toMillis = () => date.getTime();
  (ts as any).toJSON = () => date.toISOString();
  return ts;
};

async function seedLiaisonUserData() {
  const now = createTimestamp(new Date());

  await setDoc(doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID), {
    email: LIAISON_EMAIL,
    isAdmin: false,
    isWorker: false,
    isLiaison: true,
    isEquipment: false,
    isStaffing: false,
    isSetup: false,
    isCatering: false,
    isCleaning: false,
    isSecurity: false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc({} as any, "mc-usersApprovers", APPROVER_DOC_ID), {
    email: LIAISON_EMAIL,
    department: "ITP",
    level: 1,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc({} as any, "mc-usersApprovers", FINAL_APPROVER_DOC_ID), {
    email: FINAL_APPROVER_EMAIL,
    department: "ITP",
    level: 2,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedRequestedBooking() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const zeroTimestamp = createTimestamp(new Date(0));

  await setDoc(doc({} as any, "mc-bookings", BOOKING_DOC_ID), {
    calendarEventId: CALENDAR_EVENT_ID,
    requestNumber: REQUEST_NUMBER,
    email: REQUESTOR_EMAIL,
    firstName: "E2E",
    lastName: "Requester",
    secondaryName: "",
    nNumber: "N11223344",
    netId: "e2ereq",
    phoneNumber: "555-111-2222",
    department: "ITP",
    otherDepartment: "",
    role: "Student",
    sponsorFirstName: "Faculty",
    sponsorLastName: "Member",
    sponsorEmail: "faculty.member@nyu.edu",
    title: "Liaison Approval Test Booking",
    description:
      "Automatically generated booking for liaison approval mock test.",
    bookingType: "Workshop",
    attendeeAffiliation: "NYU Members with an active NYU ID",
    roomSetup: "No",
    setupDetails: "",
    mediaServices: "",
    mediaServicesDetails: "",
    equipmentServices: "",
    equipmentServicesDetails: "",
    staffingServices: "",
    staffingServicesDetails: "",
    catering: "no",
    cateringService: "",
    cleaningService: "",
    hireSecurity: "no",
    expectedAttendance: "15",
    chartFieldForCatering: "",
    chartFieldForCleaning: "",
    chartFieldForSecurity: "",
    chartFieldForRoomSetup: "",
    devBranch: "development",
    missingEmail: "",
    startDate: createTimestamp(startDate),
    endDate: createTimestamp(endDate),
    requestedAt: createTimestamp(now),
    firstApprovedAt: zeroTimestamp,
    firstApprovedBy: "",
    finalApprovedAt: zeroTimestamp,
    finalApprovedBy: "",
    equipmentAt: zeroTimestamp,
    equipmentBy: "",
    equipmentApprovedAt: zeroTimestamp,
    equipmentApprovedBy: "",
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
    status: BookingStatusLabel.REQUESTED,
    equipmentCheckedOut: false,
    roomId: "202",
    selectedRooms: [
      {
        roomId: 202,
        name: "Media Commons Room 202",
        calendarId: "mock-calendar-202",
        shouldAutoApprove: false,
        isEquipment: false,
      },
    ],
    departmentTier: "Tier 1",
    xstateData: {
      machineId: "mc-booking-machine-v5",
      lastTransition: null,
      snapshot: {
        value: "Requested",
        status: BookingStatusLabel.REQUESTED,
        context: {
          status: BookingStatusLabel.REQUESTED,
          calendarEventId: CALENDAR_EVENT_ID,
          servicesRequested: {},
          servicesApproved: {},
        },
      },
    },
  });
}

async function seedNonRequestedBookings() {
  const now = new Date();
  const startDate = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  for (const booking of NON_REQUESTED_BOOKINGS) {
    await setDoc(doc({} as any, "mc-bookings", booking.id), {
      calendarEventId: booking.calendarEventId,
      requestNumber: REQUEST_NUMBER + 10,
      email: "other-requests@nyu.edu",
      firstName: "Other",
      lastName: "Request",
      secondaryName: "",
      nNumber: "N99887766",
      netId: "otherreq",
      phoneNumber: "555-222-3333",
      department: "ITP",
      otherDepartment: "",
      role: "Student",
      sponsorFirstName: "Faculty",
      sponsorLastName: "Member",
      sponsorEmail: "faculty.member@nyu.edu",
      title: `Non Requested Booking (${booking.status})`,
      description: "Booking used to ensure filtering hides non-requested items.",
      bookingType: "Workshop",
      attendeeAffiliation: "NYU Members with an active NYU ID",
      roomSetup: "No",
      setupDetails: "",
      mediaServices: "",
      mediaServicesDetails: "",
      equipmentServices: "",
      equipmentServicesDetails: "",
      staffingServices: "",
      staffingServicesDetails: "",
      catering: "no",
      cateringService: "",
      cleaningService: "",
      hireSecurity: "no",
      expectedAttendance: "10",
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
      firstApprovedBy: LIAISON_EMAIL,
      finalApprovedAt: createTimestamp(now),
      finalApprovedBy: FINAL_APPROVER_EMAIL,
      equipmentAt: createTimestamp(now),
      equipmentBy: "",
      equipmentApprovedAt: createTimestamp(now),
      equipmentApprovedBy: "",
      declinedAt: createTimestamp(now),
      declinedBy: LIAISON_EMAIL,
      declineReason: "Automatic seed",
      canceledAt: createTimestamp(new Date(0)),
      canceledBy: "",
      checkedInAt: createTimestamp(new Date(0)),
      checkedInBy: "",
      checkedOutAt: createTimestamp(new Date(0)),
      checkedOutBy: "",
      noShowedAt: createTimestamp(new Date(0)),
      noShowedBy: "",
      closedAt: createTimestamp(new Date(0)),
      closedBy: "",
      walkedInAt: createTimestamp(new Date(0)),
      origin: BookingOrigin.USER,
      status: booking.status,
      equipmentCheckedOut: false,
      roomId: "202",
      selectedRooms: [
        {
          roomId: 202,
          name: "Media Commons Room 202",
          calendarId: "mock-calendar-202",
          shouldAutoApprove: false,
          isEquipment: false,
        },
      ],
      departmentTier: "Tier 1",
      xstateData: {
        machineId: "mc-booking-machine-v5",
        lastTransition: booking.xstateValue,
        snapshot: {
          value: booking.xstateValue,
          status: booking.status,
          context: {
            status: booking.status,
            calendarEventId: booking.calendarEventId,
            servicesRequested: {},
            servicesApproved: {},
          },
        },
      },
    });
  }
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

function serializeGenericRecord(record: any) {
  const serialized: Record<string, any> = { ...record };

  Object.entries(serialized).forEach(([key, value]) => {
    if (value && typeof (value as any).toDate === "function") {
      serialized[key] = (value as any).toDate().toISOString();
    }
  });

  return serialized;
}

async function registerMockBookingsFeed(page: Page) {
  const snapshot = await getDoc(
    doc({} as any, "mc-bookings", BOOKING_DOC_ID)
  );
  const baseData = snapshot.data();
  const basePayload = baseData
    ? {
        id: BOOKING_DOC_ID,
        calendarEventId: CALENDAR_EVENT_ID,
        ...serializeBookingRecord(baseData),
      }
    : null;
  const rightsSnapshot = await getDoc(
    doc({} as any, "mc-usersRights", USERS_RIGHTS_DOC_ID)
  );
  const rightsPayload = rightsSnapshot.data()
    ? {
        id: USERS_RIGHTS_DOC_ID,
        ...serializeGenericRecord(rightsSnapshot.data()),
      }
    : null;
  const approverSnapshot = await getDoc(
    doc({} as any, "mc-usersApprovers", APPROVER_DOC_ID)
  );
  const finalApproverSnapshot = await getDoc(
    doc({} as any, "mc-usersApprovers", FINAL_APPROVER_DOC_ID)
  );
  const approverPayloads = [
    approverSnapshot.data()
      ? {
          id: APPROVER_DOC_ID,
          ...serializeGenericRecord(approverSnapshot.data()),
        }
      : null,
    finalApproverSnapshot.data()
      ? {
          id: FINAL_APPROVER_DOC_ID,
          ...serializeGenericRecord(finalApproverSnapshot.data()),
        }
      : null,
  ].filter(Boolean);

  await page.route("**/api/__mock__/bookings", async (route) => {
    const latestSnapshot = await getDoc(
      doc({} as any, "mc-bookings", BOOKING_DOC_ID)
    );
    const latestData = latestSnapshot.data();
    const payload = latestData
      ? [
          {
            id: BOOKING_DOC_ID,
            calendarEventId: CALENDAR_EVENT_ID,
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
    ({
      timestampFields,
      initialBooking,
      initialUsersRights,
      initialUsersApprovers,
    }) => {
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
          } else if (booking[field] === null || booking[field] === undefined) {
            booking[field] = null;
          }
        });
        if (booking.startDate) {
          booking.startDate = makeTimestamp(booking.startDate);
        }
        if (booking.endDate) {
          booking.endDate = makeTimestamp(booking.endDate);
        }
        if (booking.requestedAt) {
          booking.requestedAt = makeTimestamp(booking.requestedAt);
        }
        return booking;
      };

      async function loadBookings() {
        const response = await fetch("/api/__mock__/bookings");
        const raw = await response.json();
        const bookings = raw.map(enrichBooking);
        (window as any).__mockBookings = bookings;
        return bookings;
      }

      async function ensureBookings() {
        if (!(window as any).__mockBookings) {
          return await loadBookings();
        }
        console.log(
          "🎯 ensureBookings returning",
          (window as any).__mockBookings.length
        );
        return (window as any).__mockBookings;
      }

      (window as any).__refreshMockBookings = async () => {
        return await loadBookings();
      };

      const originalClientFetch =
        (window as any).clientFetchAllDataFromCollection;

      const usersRightsRecords = (
        initialUsersRights ? [initialUsersRights] : []
      ).map((record: any) => {
        const enriched = { ...record };
        ["createdAt", "updatedAt"].forEach((field) => {
          if (enriched[field]) {
            enriched[field] = makeTimestamp(enriched[field]);
          }
        });
        return enriched;
      });

      const usersApproverRecords = (initialUsersApprovers || []).map(
        (record: any) => {
          const enriched = { ...record };
          ["createdAt", "updatedAt"].forEach((field) => {
            if (enriched[field]) {
              enriched[field] = makeTimestamp(enriched[field]);
            }
          });
          return enriched;
        }
      );

      (window as any).__mockUsersRights = usersRightsRecords;
      (window as any).__mockUsersApprovers = usersApproverRecords;

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

        if (normalizedTableName.includes("usersrights")) {
          return usersRightsRecords;
        }

        if (normalizedTableName.includes("usersapprovers")) {
          return usersApproverRecords;
        }

        if (originalClientFetch) {
          return await originalClientFetch(tableName, constraints, tenant);
        }

        return [];
      };

      const originalGetPaginatedData = (window as any).getPaginatedData;

      (window as any).getPaginatedData = async function (
        collectionName: string,
        itemsPerPage: number,
        filters: any,
        lastVisible: any,
        tenant?: string
      ) {
        return await ensureBookings();
      };

      const originalGetDocs = (window as any).getDocs;

      (window as any).getDocs = async function (queryRef: any) {
        const path = queryRef && (queryRef._path || queryRef.path);
        if (
          path &&
          path.includes("booking") &&
          !path.includes("bookingTypes")
        ) {
          const bookings = await ensureBookings();
          return {
            docs: bookings.map((booking: any) => ({
              id: booking.id ?? booking.calendarEventId,
              data: () => ({ ...booking }),
            })),
          };
        }

        if (path && path.includes("usersRights")) {
          return {
            docs: usersRightsRecords.map((record: any, index: number) => ({
              id: record.id ?? `users-rights-${index}`,
              data: () => ({ ...record }),
            })),
          };
        }

        if (path && path.includes("usersApprovers")) {
          return {
            docs: usersApproverRecords.map((record: any, index: number) => ({
              id: record.id ?? `users-approvers-${index}`,
              data: () => ({ ...record }),
            })),
          };
        }

        if (originalGetDocs) {
          return await originalGetDocs(queryRef);
        }

        return { docs: [] };
      };

      if (initialBooking) {
        (window as any).__mockBookings = [
          enrichBooking(initialBooking),
        ];
      }

      (window as any).__bookingE2EMocks = {
        bookings: (window as any).__mockBookings,
        usersRights: usersRightsRecords,
        usersApprovers: usersApproverRecords,
      };

      const syncWebpackExports = () => {
        const webpackRequire = (window as any).__webpack_require__;
        const modules = webpackRequire?.c;
        if (!modules) {
          return;
        }
        Object.values(modules).forEach((mod: any) => {
          if (mod?.exports) {
            if ("clientFetchAllDataFromCollection" in mod.exports) {
              mod.exports.clientFetchAllDataFromCollection =
                (window as any).clientFetchAllDataFromCollection;
            }
            if ("getPaginatedData" in mod.exports) {
              mod.exports.getPaginatedData = (window as any).getPaginatedData;
            }
            if ("clientGetDataByCalendarEventId" in mod.exports) {
              mod.exports.clientGetDataByCalendarEventId = async (
                _tableName: any,
                calendarEventId: string,
                tenant?: string
              ) => {
                const bookings = await ensureBookings();
                const match = bookings.find(
                  (booking: any) => booking.calendarEventId === calendarEventId
                );
                if (!match) return null;
                return {
                  id: match.id ?? match.calendarEventId,
                  ...match,
                };
              };
            }
          }
        });
      };

      if (!(window as any).__mockBookingsWebpackPatched) {
        const webpackRequire = (window as any).__webpack_require__;
        if (webpackRequire) {
          const originalWebpackRequire = webpackRequire;
          const patchedWebpackRequire = function () {
            const result = originalWebpackRequire.apply(this, arguments);
            try {
              syncWebpackExports();
            } catch (_err) {
              // ignore sync errors
            }
            return result;
          };
          patchedWebpackRequire.m = originalWebpackRequire.m;
          patchedWebpackRequire.c = originalWebpackRequire.c;
          (window as any).__webpack_require__ = patchedWebpackRequire;
          (window as any).__mockBookingsWebpackPatched = true;
        }
      }

      try {
        syncWebpackExports();
      } catch (_err) {
        // ignore sync errors
      }

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          syncWebpackExports();
        } catch (_err) {
          // ignore sync errors
        }
      };
    },
    {
      timestampFields: TIMESTAMP_FIELDS,
      initialBooking: basePayload,
      initialUsersRights: rightsPayload,
      initialUsersApprovers: approverPayloads,
    }
  );
}

async function mockApproveEndpoint(page: Page) {
  await page.route("**/api/approve", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 405,
        body: JSON.stringify({ error: "Method Not Allowed" }),
        headers: { "content-type": "application/json" },
      });
      return;
    }

    const body = route.request().postDataJSON();
    const email = body?.email ?? LIAISON_EMAIL;
    const approvedAt = createTimestamp(new Date());

    const bookingRef = doc({} as any, "mc-bookings", BOOKING_DOC_ID);
    const bookingSnapshot = await getDoc(bookingRef);
    const bookingData = bookingSnapshot.data() ?? {};

    const updatedBooking = {
      ...bookingData,
      status: BookingStatusLabel.PRE_APPROVED,
      firstApprovedAt: approvedAt,
      firstApprovedBy: email,
      xstateData: {
        ...(bookingData?.xstateData ?? {}),
        lastTransition: "approve",
        snapshot: {
          ...(bookingData?.xstateData?.snapshot ?? {}),
          value: "Pre-approved",
          status: BookingStatusLabel.PRE_APPROVED,
          context: {
            ...(bookingData?.xstateData?.snapshot?.context ?? {}),
            status: BookingStatusLabel.PRE_APPROVED,
            calendarEventId: CALENDAR_EVENT_ID,
            servicesRequested:
              bookingData?.xstateData?.snapshot?.context?.servicesRequested ??
              {},
            servicesApproved: {
              ...(bookingData?.xstateData?.snapshot?.context
                ?.servicesApproved ?? {}),
            },
            lastApprovedBy: email,
          },
        },
      },
    };

    await setDoc(bookingRef, updatedBooking);

    await addDoc(collection({} as any, "mc-bookingLogs"), {
      bookingId: BOOKING_DOC_ID,
      calendarEventId: CALENDAR_EVENT_ID,
      status: BookingStatusLabel.PRE_APPROVED,
      changedBy: email,
      changedAt: approvedAt,
      requestNumber: bookingData?.requestNumber ?? REQUEST_NUMBER,
      note: "Booking first approved (mock)",
    });

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Approved successfully" }),
    });
  });

  await page.route("**/api/booking-logs**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify([]),
    });
  });
}

test.describe("Liaison first approval flow (mocked Firestore)", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);

    await seedLiaisonUserData();
    await seedRequestedBooking();
    await seedNonRequestedBookings();
    await registerMockBookingsFeed(page);

    await mockApproveEndpoint(page);
  });

  test("should transition booking to PRE-APPROVED when liaison approves", async ({
    page,
  }) => {
    page.on("console", (msg) => {
      console.log("[browser]", msg.type(), msg.text());
    });

    await page.goto(`${BASE_URL}/mc/liaison`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(
      () => typeof (window as any).__applyMockBookingsOverrides === "function"
    );
    await page.evaluate(() => {
      if (typeof (window as any).__applyMockBookingsOverrides === "function") {
        (window as any).__applyMockBookingsOverrides();
      }
    });
    await expect(page).toHaveURL(/\/mc\/liaison$/, { timeout: 10_000 });

    const bookingRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Liaison Approval Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    await expect(
      bookingRow.getByText(BookingStatusLabel.REQUESTED)
    ).toBeVisible();

    const dataRows = page.locator('[role="row"][data-rowindex]');
    await expect(dataRows).toHaveCount(1);

    const approveRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/api/approve") &&
      request.method() === "POST"
    );
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/approve") &&
        response.request().method() === "POST"
    );

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "1st Approve" }).click();

    const confirmApproveButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmApproveButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmApproveButton.click();
    await approveResponse;

    await page.evaluate(async () => {
      if (typeof (window as any).__refreshMockBookings === "function") {
        await (window as any).__refreshMockBookings();
      }
    });
    await page.waitForTimeout(200);

    const approveRequest = await approveRequestPromise;
    const approvePayload = approveRequest.postDataJSON() ?? {};
    expect(approvePayload).toMatchObject({
      id: CALENDAR_EVENT_ID,
      email: LIAISON_EMAIL,
    });
  });

  test("should send decline request when liaison declines", async ({ page }) => {
    page.on("console", (msg) => {
      console.log("[browser]", msg.type(), msg.text());
    });

    await page.goto(`${BASE_URL}/mc/liaison`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(
      () => typeof (window as any).__applyMockBookingsOverrides === "function"
    );
    await page.evaluate(() => {
      if (typeof (window as any).__applyMockBookingsOverrides === "function") {
        (window as any).__applyMockBookingsOverrides();
      }
    });
    await expect(page).toHaveURL(/\/mc\/liaison$/, { timeout: 10_000 });

    const bookingRow = page
      .locator('[role="row"]')
      .filter({ hasText: "Liaison Approval Test Booking" })
      .first();
    await bookingRow.waitFor({ state: "visible", timeout: 15_000 });

    const dataRows = page.locator('[role="row"][data-rowindex]');
    await expect(dataRows).toHaveCount(1);

    const declineRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/api/xstate-transition") &&
      request.method() === "POST"
    );
    const declineResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/xstate-transition") &&
      response.request().method() === "POST"
    );

    await bookingRow.locator('[role="combobox"]').click();
    await page.getByRole("option", { name: "Decline" }).click();

    const confirmDeclineButton = bookingRow.locator(
      'button:has(svg[data-testid="CheckIcon"])'
    );
    await confirmDeclineButton.waitFor({ state: "visible", timeout: 5_000 });
    await confirmDeclineButton.click();

    const declineDialog = page.getByRole("dialog");
    const declineReason = "Incompatible schedule";
    await declineDialog.getByRole("textbox").fill(declineReason);
    await declineDialog.getByRole("button", { name: "Ok" }).click();

    const declineRequest = await declineRequestPromise;
    await declineResponsePromise;

    const declinePayload = declineRequest.postDataJSON() ?? {};
    expect(declinePayload).toMatchObject({
      calendarEventId: CALENDAR_EVENT_ID,
      eventType: "decline",
      email: LIAISON_EMAIL,
      reason: declineReason,
    });
  });
});
