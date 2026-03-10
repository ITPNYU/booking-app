import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Environment variables
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_BRANCH_NAME = "test";

// Firebase mocks
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerGetDocumentById = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockGetTenantEmailConfig = vi.fn();
const mockGetApprovalCcEmail = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: (...args: any[]) =>
    mockServerGetDataByCalendarEventId(...args),
  serverGetDocumentById: (...args: any[]) =>
    mockServerGetDocumentById(...args),
  serverSaveDataToFirestore: (...args: any[]) =>
    mockServerSaveDataToFirestore(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
  serverUpdateDataByCalendarEventId: (...args: any[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: any[]) =>
    mockGetTenantEmailConfig(...args),
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    TENANT_SCHEMA: "tenantSchemas",
    PRE_BAN_LOGS: "preBanLogs",
  },
  getApprovalCcEmail: (...args: any[]) => mockGetApprovalCcEmail(...args),
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    REQUESTED: "REQUESTED",
    PRE_APPROVED: "PRE-APPROVED",
    APPROVED: "APPROVED",
    DECLINED: "DECLINED",
    CANCELED: "CANCELED",
    CHECKED_IN: "CHECKED-IN",
    CHECKED_OUT: "CHECKED-OUT",
    NO_SHOW: "NO-SHOW",
    UNKNOWN: "UNKNOWN",
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      Timestamp: {
        now: () => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 }),
      },
    },
  },
  firestore: {
    Timestamp: {
      now: () => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 }),
    },
  },
}));

vi.mock("@/lib/logger/bookingLogger", () => ({
  BookingLogger: {
    calendarUpdate: vi.fn(),
    calendarError: vi.fn(),
    xstateTransition: vi.fn(),
  },
}));

vi.mock("./xstatePersistence", () => ({
  cleanObjectForFirestore: (obj: any) => obj,
}));

const defaultEmailConfig = {
  emailMessages: {
    declined: "Your booking has been declined.",
    canceled: "Your booking has been canceled.",
    noShow: "You have been marked as a no-show. Violation count: ${violationCount}.",
    checkoutConfirmation: "You have been checked out.",
  },
};

function makeSnapshot(value: string | object, context: any = {}) {
  return { value, context };
}

describe("xstateEffects", () => {
  const calendarEventId = "test-event-123";
  const email = "admin@nyu.edu";
  const tenant = "mc";

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    mockGetTenantEmailConfig.mockResolvedValue(defaultEmailConfig);
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      email: "guest@nyu.edu",
    });
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
    mockServerGetDocumentById.mockResolvedValue(null);
    mockGetApprovalCcEmail.mockReturnValue("admin-cc@nyu.edu");
    mockServerSaveDataToFirestore.mockResolvedValue(undefined);
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
  });

  describe("handleStateTransitions", () => {
    let handleStateTransitions: any;

    beforeEach(async () => {
      const mod = await import(
        "@/lib/stateMachines/xstateEffects"
      );
      handleStateTransitions = mod.handleStateTransitions;
    });

    it("should skip when no state change", async () => {
      const firestoreUpdates: any = {};
      await handleStateTransitions(
        makeSnapshot("Requested"),
        makeSnapshot("Requested"),
        calendarEventId,
        email,
        tenant,
        firestoreUpdates,
      );

      // No external calls should be made
      expect(mockServerGetDataByCalendarEventId).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
    });

    describe("Approved transition", () => {
      it("should set finalApprovedAt and finalApprovedBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Pre-approved"),
          makeSnapshot("Approved"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.finalApprovedAt).toBeDefined();
        expect(firestoreUpdates.finalApprovedBy).toBe(email);
      });

      it("should not set finalApprovedBy when email is undefined", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Pre-approved"),
          makeSnapshot("Approved"),
          calendarEventId,
          undefined,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.finalApprovedAt).toBeDefined();
        expect(firestoreUpdates.finalApprovedBy).toBeUndefined();
      });
    });

    describe("Declined transition", () => {
      it("should set declinedAt and declinedBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.declinedAt).toBeDefined();
        expect(firestoreUpdates.declinedBy).toBe(email);
      });

      it("should send decline email to guest", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            calendarEventId,
            targetEmail: "guest@nyu.edu",
            status: "DECLINED",
            tenant,
          }),
        );
      });

      it("should include declined services in email message", async () => {
        const firestoreUpdates: any = {};
        const context = {
          servicesApproved: { staff: false, equipment: true, catering: false },
          servicesRequested: { staff: true, equipment: true, catering: true },
        };

        await handleStateTransitions(
          makeSnapshot("Pre-approved"),
          makeSnapshot("Declined", context),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];
        expect(emailCall.headerMessage).toContain("Staff");
        expect(emailCall.headerMessage).toContain("Catering");
        expect(emailCall.headerMessage).not.toContain("Equipment");
      });

      it("should include grace period from tenant schema", async () => {
        mockServerGetDocumentById.mockResolvedValue({
          declinedGracePeriod: 48,
        });

        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];
        expect(emailCall.headerMessage).toContain("48 hours");
      });

      it("should default grace period to 24 hours", async () => {
        mockServerGetDocumentById.mockResolvedValue(null);

        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];
        expect(emailCall.headerMessage).toContain("24 hours");
      });

      it("should update calendar with DECLINED status", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/calendarEvents",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
              calendarEventId,
              newValues: { statusPrefix: "DECLINED" },
            }),
          }),
        );
      });

      it("should skip email when no guest email in booking", async () => {
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          email: null,
        });

        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Declined"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      });

      it("should not crash when email sending fails", async () => {
        mockServerSendBookingDetailEmail.mockRejectedValue(
          new Error("SMTP error"),
        );

        const firestoreUpdates: any = {};
        await expect(
          handleStateTransitions(
            makeSnapshot("Requested"),
            makeSnapshot("Declined"),
            calendarEventId,
            email,
            tenant,
            firestoreUpdates,
          ),
        ).resolves.not.toThrow();

        // Calendar update should still be attempted
        expect(mockFetch).toHaveBeenCalled();
      });

      it("should not crash when calendar update fails", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        const firestoreUpdates: any = {};
        await expect(
          handleStateTransitions(
            makeSnapshot("Requested"),
            makeSnapshot("Declined"),
            calendarEventId,
            email,
            tenant,
            firestoreUpdates,
          ),
        ).resolves.not.toThrow();
      });
    });

    describe("No Show transition", () => {
      it("should set noShowedAt and noShowedBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Approved"),
          makeSnapshot("No Show"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.noShowedAt).toBeDefined();
        expect(firestoreUpdates.noShowedBy).toBe(email);
      });
    });

    describe("Canceled transition", () => {
      it("should set canceledAt and canceledBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Approved"),
          makeSnapshot("Canceled"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.canceledAt).toBeDefined();
        expect(firestoreUpdates.canceledBy).toBe(email);
      });
    });

    describe("Checked In transition", () => {
      it("should set checkedInAt and checkedInBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Approved"),
          makeSnapshot("Checked In"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
          { getPersistedSnapshot: () => ({ value: "Checked In" }) },
        );

        expect(firestoreUpdates.checkedInAt).toBeDefined();
        expect(firestoreUpdates.checkedInBy).toBe(email);
      });

      it("should pre-persist XState snapshot before calendar update", async () => {
        const firestoreUpdates: any = {};
        const mockActor = {
          getPersistedSnapshot: () => ({
            value: "Checked In",
            context: {},
          }),
        };

        await handleStateTransitions(
          makeSnapshot("Approved"),
          makeSnapshot("Checked In"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
          mockActor,
        );

        expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
          "bookings",
          calendarEventId,
          expect.objectContaining({
            xstateData: expect.objectContaining({
              snapshot: expect.any(Object),
            }),
            checkedInAt: expect.any(Object),
          }),
          tenant,
        );
      });

      it("should update calendar with CHECKED_IN status", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Approved"),
          makeSnapshot("Checked In"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
          { getPersistedSnapshot: () => ({ value: "Checked In" }) },
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/calendarEvents",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
              calendarEventId,
              newValues: { statusPrefix: "CHECKED-IN" },
            }),
          }),
        );
      });

      it("should not crash when pre-persist fails", async () => {
        mockServerUpdateDataByCalendarEventId.mockRejectedValue(
          new Error("Firestore error"),
        );

        const firestoreUpdates: any = {};
        await expect(
          handleStateTransitions(
            makeSnapshot("Approved"),
            makeSnapshot("Checked In"),
            calendarEventId,
            email,
            tenant,
            firestoreUpdates,
            { getPersistedSnapshot: () => ({ value: "Checked In" }) },
          ),
        ).resolves.not.toThrow();
      });
    });

    describe("Pre-approved transition", () => {
      it("should set firstApprovedAt and firstApprovedBy", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Pre-approved"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(firestoreUpdates.firstApprovedAt).toBeDefined();
        expect(firestoreUpdates.firstApprovedBy).toBe(email);
      });

      it("should save pre-approval data to Firestore", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Pre-approved"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
          "bookings",
          calendarEventId,
          expect.objectContaining({
            firstApprovedAt: expect.any(Object),
            firstApprovedBy: email,
          }),
          tenant,
        );
      });

      it("should update calendar with PRE_APPROVED status", async () => {
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Pre-approved"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/calendarEvents",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
              calendarEventId,
              newValues: { statusPrefix: "PRE-APPROVED" },
            }),
          }),
        );
      });

      it("should include xstateData if present in firestoreUpdates", async () => {
        const xstateData = {
          snapshot: { value: "Pre-approved" },
          machineId: "test",
          lastTransition: "2026-01-01",
        };
        const firestoreUpdates: any = { xstateData };

        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot("Pre-approved"),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
          "bookings",
          calendarEventId,
          expect.objectContaining({ xstateData }),
          tenant,
        );
      });
    });

    describe("Parallel states (Service Closeout, Services Request)", () => {
      it("should not trigger side effects for Service Closeout (handled by /api/checkout-processing)", async () => {
        const serviceCloseoutState = { "Service Closeout": "some-state" };
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Checked In"),
          makeSnapshot(serviceCloseoutState),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        // No emails, calendar updates, or timestamp fields from handleStateTransitions
        expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(firestoreUpdates.checkedOutAt).toBeUndefined();
      });

      it("should not trigger side effects for Services Request (handled by /api/services)", async () => {
        const servicesRequestState = { "Services Request": "some-state" };
        const firestoreUpdates: any = {};
        await handleStateTransitions(
          makeSnapshot("Requested"),
          makeSnapshot(servicesRequestState),
          calendarEventId,
          email,
          tenant,
          firestoreUpdates,
        );

        expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(firestoreUpdates.status).toBeUndefined();
      });
    });
  });

  describe("sendCanceledEmail", () => {
    let sendCanceledEmail: any;

    beforeEach(async () => {
      const mod = await import("@/lib/stateMachines/xstateEffects");
      sendCanceledEmail = mod.sendCanceledEmail;
    });

    it("should send cancel email to guest from booking doc", async () => {
      await sendCanceledEmail(calendarEventId, email, tenant);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarEventId,
          targetEmail: "guest@nyu.edu",
          status: "CANCELED",
          tenant,
        }),
      );
    });

    it("should use email parameter as fallback when booking has no email", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue({
        email: null,
      });

      await sendCanceledEmail(calendarEventId, "fallback@nyu.edu", tenant);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          targetEmail: "fallback@nyu.edu",
        }),
      );
    });

    it("should skip email when no email available", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue({
        email: null,
      });

      await sendCanceledEmail(calendarEventId, undefined, tenant);

      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
    });

    it("should not crash when email sending fails", async () => {
      mockServerSendBookingDetailEmail.mockRejectedValue(
        new Error("SMTP error"),
      );

      await expect(
        sendCanceledEmail(calendarEventId, email, tenant),
      ).resolves.not.toThrow();
    });
  });
});
