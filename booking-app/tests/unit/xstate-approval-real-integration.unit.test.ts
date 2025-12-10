import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockTimestamp = () => ({
  toDate: () => new Date(),
  toMillis: () => Date.now(),
});

const buildDefaultBookingDoc = (email: string) => ({
  id: "booking-123",
  requestNumber: 12345,
  email,
  title: "Test Booking",
  role: "Student",
  sponsorEmail: "sponsor@nyu.edu",
  roomId: "224",
  startDate: createMockTimestamp(),
  endDate: createMockTimestamp(),
  requestedAt: createMockTimestamp(),
  firstApprovedAt: null,
  finalApprovedAt: null,
  declinedAt: null,
  canceledAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  noShowedAt: null,
  walkedInAt: null,
});

process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error && reason.message === "Booking not found") {
    return;
  }
  throw reason;
});

const waitForMockCall = async (
  mockFn: ReturnType<typeof vi.fn>,
  predicate: (arg: any) => boolean,
  timeout = 500
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const matchingCall = mockFn.mock.calls.find(([firstArg]) =>
      predicate(firstArg)
    );
    if (matchingCall) {
      return matchingCall[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for mock call");
};

const loadAdminModule = async () => {
  const adminModule = await import("@/components/src/server/admin");
  const updateFn = (adminModule as any).serverUpdateDataByCalendarEventId;
  if (!(updateFn && updateFn.mock)) {
    vi.spyOn(
      adminModule,
      "serverUpdateDataByCalendarEventId"
    ).mockImplementation(
      async (
        collectionName: string,
        calendarEventId: string,
        updatedData: object,
        tenant?: string
      ) => {
        const booking = await mockServerGetDataByCalendarEventId(
          collectionName,
          calendarEventId,
          tenant
        );

        if (!booking) {
          return;
        }

        return mockServerUpdateDataByCalendarEventId(
          collectionName,
          calendarEventId,
          updatedData,
          tenant
        );
      }
    );
  }
  return adminModule;
};

// Mock environment variables
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_BRANCH_NAME = "test";

// Mock Firebase functions
const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerUpdateInFirestore = vi.fn();
const mockServerDeleteData = vi.fn();
const mockServerDeleteDocumentFields = vi.fn();
const mockServerGetDocumentById = vi.fn();
const mockServerGetFinalApproverEmail = vi.fn();

// Mock XState utilities - but we'll use real XState machine in tests
const mockExecuteXStateTransition = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverFetchAllDataFromCollection: mockServerFetchAllDataFromCollection,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverUpdateInFirestore: mockServerUpdateInFirestore,
  serverDeleteData: mockServerDeleteData,
  serverDeleteDocumentFields: mockServerDeleteDocumentFields,
  serverGetDocumentById: mockServerGetDocumentById,
  serverGetFinalApproverEmail: mockServerGetFinalApproverEmail,
}));

// Don't mock XState utilities - we want to test the real XState machine
// vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
//   executeXStateTransition: mockExecuteXStateTransition,
// }));

vi.mock("@/components/src/server/admin", async () => {
  const actual = await vi.importActual("@/components/src/server/admin");

  return {
    ...actual,
    serverUpdateDataByCalendarEventId: async (
      collectionName: string,
      calendarEventId: string,
      updatedData: object,
      tenant?: string
    ) => {
      const booking = await mockServerGetDataByCalendarEventId(
        collectionName,
        calendarEventId,
        tenant
      );

      if (!booking) {
        return;
      }

      return mockServerUpdateDataByCalendarEventId(
        collectionName,
        calendarEventId,
        updatedData,
        tenant
      );
    },
    serverApproveBooking: vi
      .fn()
      .mockResolvedValue({ status: 200, message: "Approved successfully" }),
  };
});

describe("XState Approval Real Integration Tests", () => {
  const testCalendarEventId = "test-calendar-event-123";
  const testEmail = "test@nyu.edu";
  const testTenant = "mc";

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve("OK"),
    });

    // Setup Firebase mocks
    mockServerGetDataByCalendarEventId.mockResolvedValue(
      buildDefaultBookingDoc(testEmail)
    );
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerUpdateInFirestore.mockResolvedValue(undefined);
    mockServerDeleteData.mockResolvedValue(undefined);
    mockServerDeleteDocumentFields.mockResolvedValue(undefined);
    mockServerGetDocumentById.mockResolvedValue(null);
    mockServerGetFinalApproverEmail.mockResolvedValue("finalapprover@nyu.edu");
  });

  describe("1. XState Machine Transitions", () => {
    it("should auto-approve when conditions are met", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // Context for auto-approval
      const context = {
        tenant: testTenant,
        selectedRooms: [{ 
          roomId: "224", 
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
            conditions: {
              setup: false,
              equipment: false,
              staffing: false,
              catering: false,
              cleaning: false,
              security: false,
            }
          }
        }],
        servicesRequested: {}, // No services = auto-approve
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: false,
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should auto-approve to Approved state
      expect(actor.getSnapshot().value).toBe("Approved");
      expect(actor.getSnapshot().context.tenant).toBe(testTenant);
      expect(actor.getSnapshot().context.email).toBe(testEmail);
    });

    it("should require manual approval when auto-approval conditions are not met", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // Context that prevents auto-approval
      const context = {
        tenant: testTenant,
        selectedRooms: [{ 
          roomId: "224", 
          // No autoApproval config = disabled
        }],
        servicesRequested: {},
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: false,
        _restoredFromStatus: true, // Prevents auto-approval
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should start in Requested state
      expect(actor.getSnapshot().value).toBe("Requested");

      // Manual approve should go to Pre-approved
      actor.send({ type: "approve" });
      expect(actor.getSnapshot().value).toBe("Pre-approved");

      // Second approve should go to Approved
      actor.send({ type: "approve" });
      expect(actor.getSnapshot().value).toBe("Approved");
    });

    it("should handle VIP booking with services", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // VIP booking with services
      const context = {
        tenant: testTenant,
        selectedRooms: [{ 
          roomId: "224", 
          autoApproval: {
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: -1, faculty: -1, student: -1 },
            conditions: {
              setup: false,
              equipment: false,
              staffing: false,
              catering: false,
              cleaning: false,
              security: false,
            }
          }
        }],
        servicesRequested: {
          cleaning: true,
          setup: true,
        },
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: true,
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should go to Services Request state
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual(
        expect.objectContaining({
          "Services Request": expect.any(Object),
        })
      );

      // Approve services
      actor.send({ type: "approveCleaning" });
      actor.send({ type: "approveSetup" });

      // Check that services are approved in context
      const finalSnapshot = actor.getSnapshot();
      expect(finalSnapshot.context.servicesApproved?.cleaning).toBe(true);
      expect(finalSnapshot.context.servicesApproved?.setup).toBe(true);
    });
  });

  describe("2. Email Sending Verification", () => {
    it("should call correct email APIs when serverApproveEvent is executed", async () => {
      // Create a spy on fetch to monitor email API calls
      const fetchSpy = vi.spyOn(global, "fetch");

      // Mock serverBookingContents to return test data
      const mockBookingContents = vi.fn().mockResolvedValue({
        email: testEmail,
        title: "Test Booking",
        role: "Student",
        sponsorEmail: "sponsor@nyu.edu",
        roomId: "224",
      });

      // Mock other dependencies
      const mockGetFinalApproverEmail = vi
        .fn()
        .mockResolvedValue("finalapprover@nyu.edu");
      const mockGetApprovalCcEmail = vi
        .fn()
        .mockReturnValue("samantha@nyu.edu");

      // Temporarily mock the admin module
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverBookingContents: mockBookingContents,
          serverGetFinalApproverEmail: mockGetFinalApproverEmail,
          getApprovalCcEmail: mockGetApprovalCcEmail,
          serverUpdateDataByCalendarEventId: vi
            .fn()
            .mockImplementation(
              async (
                collectionName: string,
                calendarEventId: string,
                updatedData: object,
                tenant?: string
              ) => {
                const booking = await mockServerGetDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  tenant
                );

                if (!booking) {
                  return;
                }

                return mockServerUpdateDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  updatedData,
                  tenant
                );
              }
            ),
        };
      });

      // Re-import to get mocked version
      vi.resetModules();
      const { serverApproveEvent } = await loadAdminModule();

      // Execute the function
      await serverApproveEvent(testCalendarEventId, testTenant);

      // Verify booking data was requested from Firestore
      expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
        expect.stringMatching(/bookings/i),
        testCalendarEventId,
        testTenant
      );

      // Verify email API was called (serverSendBookingDetailEmail calls /api/sendEmail)
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/sendEmail",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining(testEmail),
        })
      );

      // Verify calendar update API was called
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/calendarEvents",
        expect.objectContaining({
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": testTenant,
          },
          body: expect.stringContaining("APPROVED"),
        })
      );

      // Verify user invitation API was called
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/inviteUser",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining(testEmail),
        })
      );
    });
  });

  describe("3. Calendar Update Verification", () => {
    it("should update calendar with APPROVED status", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      // Mock dependencies
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverBookingContents: vi.fn().mockResolvedValue({
            email: testEmail,
            roomId: "224",
          }),
        };
      });

      vi.resetModules();
      const { serverApproveEvent } = await loadAdminModule();

      await serverApproveEvent(testCalendarEventId, testTenant);

      // Verify calendar event update with APPROVED status
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/calendarEvents",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": testTenant,
          },
          body: JSON.stringify({
            calendarEventId: testCalendarEventId,
            newValues: { statusPrefix: "APPROVED" },
          }),
        }
      );
    });
  });

  describe("4. BookingLog Verification", () => {
    it("should write APPROVED status to BookingLog", async () => {
      // Mock dependencies
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverFinalApprove: vi.fn().mockResolvedValue(undefined),
          serverApproveEvent: vi.fn().mockResolvedValue(undefined),
          serverUpdateDataByCalendarEventId: vi
            .fn()
            .mockImplementation(
              async (
                collectionName: string,
                calendarEventId: string,
                updatedData: object,
                tenant?: string
              ) => {
                const booking = await mockServerGetDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  tenant
                );

                if (!booking) {
                  return;
                }

                return mockServerUpdateDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  updatedData,
                  tenant
                );
              }
            ),
        };
      });

      vi.resetModules();
      const { finalApprove } = await loadAdminModule();

      // Execute finalApprove
      await finalApprove(testCalendarEventId, testEmail, testTenant);

      // Verify booking data was retrieved
      expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
        "bookings",
        testCalendarEventId,
        testTenant
      );

      // Verify BookingLog was written with APPROVED status
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        status: "APPROVED",
        changedBy: testEmail,
        requestNumber: 12345,
        calendarEventId: testCalendarEventId,
        note: "",
        tenant: testTenant,
      });
    });

    it("should handle missing booking data gracefully", async () => {
      // Mock missing booking data
      mockServerGetDataByCalendarEventId.mockImplementation(async () => null);

      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverFinalApprove: vi.fn().mockResolvedValue(undefined),
          serverApproveEvent: vi.fn().mockResolvedValue(undefined),
          serverUpdateDataByCalendarEventId: vi
            .fn()
            .mockImplementation(
              async (
                collectionName: string,
                calendarEventId: string,
                updatedData: object,
                tenant?: string
              ) => {
                const booking = await mockServerGetDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  tenant
                );

                if (!booking) {
                  return;
                }

                return mockServerUpdateDataByCalendarEventId(
                  collectionName,
                  calendarEventId,
                  updatedData,
                  tenant
                );
              }
            ),
        };
      });

      vi.resetModules();
      const { finalApprove } = await loadAdminModule();

      try {
        await finalApprove(testCalendarEventId, testEmail, testTenant);

        // Should not write to BookingLog when booking data is missing
        expect(mockLogServerBookingChange).not.toHaveBeenCalled();
      } finally {
        mockServerGetDataByCalendarEventId.mockImplementation(async () =>
          buildDefaultBookingDoc(testEmail)
        );
      }
    });
  });

  describe("5. Real XState Machine Integration Tests", () => {
    describe("Auto-Approval Flow", () => {
      it("should transition XState to Approved and trigger real side effects", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data for XState actions to use
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-123",
          requestNumber: 12345,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "REQUESTED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "Test Booking",
          description: "Test Description",
          roomId: "224",
          department: "IDM",
          role: "Student",
        });

        // Create booking context that will auto-approve
        const context = {
          tenant: testTenant,
          selectedRooms: [{ 
            roomId: "224", 
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: -1 },
              maxHour: { admin: -1, faculty: -1, student: -1 },
              conditions: {
                setup: false,
                equipment: false,
                staffing: false,
                catering: false,
                cleaning: false,
                security: false,
              }
            }
          }],
          servicesRequested: {}, // No services = auto-approve
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: false,
          isVip: false,
        };

        // Start the actual XState machine WITHOUT providing custom actions
        // This tests the real machine with real actions
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // Verify XState reached Approved state
        expect(actor.getSnapshot().value).toBe("Approved");
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Wait for async actions to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify that the real XState machine transitioned correctly
        // The real XState actions are placeholders (console.log only)
        // Actual side effects are handled by external processing after XState

        // Verify that XState reached the correct final state
        expect(actor.getSnapshot().value).toBe("Approved");
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Note: For Approved state, XState actions are mostly placeholders (console.log only)
        // Real side effects (emails, calendar updates, logs) are handled by external processing
        // via /api/approve → finalApprove function → logServerBookingChange

        // Test integration: XState reaches Approved, then manual /api/approve processing
        // Note: XState doesn't automatically call /api/approve - it only manages state transitions
        // The /api/approve endpoint is called manually and handles the side effects
        vi.clearAllMocks();

        // Import and call finalApprove to simulate what /api/approve does when XState reaches "Approved"
        const { finalApprove } = await import("@/components/src/server/admin");

        // Call finalApprove (this is what /api/approve does when XState reaches "Approved")
        await finalApprove(testCalendarEventId, testEmail, testTenant);

        // Verify that finalApprove actually called logServerBookingChange for APPROVED status
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "APPROVED",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "",
          })
        );

        // Test XState's logBookingHistory action with No Show from Approved state
        vi.clearAllMocks();

        // Ensure we're in Approved state for No Show test
        expect(actor.getSnapshot().value).toBe("Approved");

        // Simulate no show scenario to test XState's logBookingHistory action
        actor.send({ type: "noShow" });

        // Wait for async logBookingHistory action to complete
        // No Show state has 'always' transition to 'Canceled', so it happens quickly
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify that XState's logBookingHistory action called mockLogServerBookingChange
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "Booking marked as no show",
          })
        );

        // Verify final state after no show (No Show → Canceled → Closed due to no services)
        expect(actor.getSnapshot().value).toBe("Closed");
      });
    });

    describe("Manual Approval Flow", () => {
      it("should transition XState from Requested to Pre-approved and trigger appropriate side effects", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-456",
          requestNumber: 12346,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "REQUESTED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "Manual Approval Test Booking",
          description: "Test Description",
          roomId: "224",
          department: "IDM",
          role: "Student",
        });

        // Create booking context that requires manual approval
        const context = {
          tenant: testTenant,
          selectedRooms: [{ roomId: "224", shouldAutoApprove: false }],
          servicesRequested: {},
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: false,
          isVip: false,
          _restoredFromStatus: true, // Prevents auto-approval
        };

        // Use the real XState machine
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // Should start in Requested state
        expect(actor.getSnapshot().value).toBe("Requested");

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate manual approval
        actor.send({ type: "approve" });

        // Should transition to Pre-approved
        expect(actor.getSnapshot().value).toBe("Pre-approved");

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify that XState transitioned correctly
        expect(actor.getSnapshot().value).toBe("Pre-approved");
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Test integration: XState reaches Pre-approved, then manual /api/approve processing
        vi.clearAllMocks();

        // Import and call serverFirstApproveOnly to simulate what /api/approve does when XState reaches "Pre-approved"
        const { serverFirstApproveOnly } = await import(
          "@/components/src/server/admin"
        );

        // Call serverFirstApproveOnly (this is what /api/approve does when XState reaches "Pre-approved")
        await serverFirstApproveOnly(
          testCalendarEventId,
          testEmail,
          testTenant
        );

        // Verify that serverFirstApproveOnly actually called logServerBookingChange for PRE-APPROVED status
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "PRE-APPROVED",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
          })
        );

        // Test XState's logBookingHistory action by transitioning to Approved first, then No Show
        vi.clearAllMocks();

        // Transition to Approved state first (from Pre-approved)
        actor.send({ type: "approve" });
        expect(actor.getSnapshot().value).toBe("Approved");

        // Now simulate no show scenario to test XState's logBookingHistory action
        actor.send({ type: "noShow" });

        // Wait for async logBookingHistory action to complete
        // No Show state has 'always' transition to 'Canceled', so it happens quickly
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Verify that XState's logBookingHistory action called mockLogServerBookingChange
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "Booking marked as no show",
          })
        );

        // Verify final state after no show (No Show → Canceled → Closed due to no services)
        expect(actor.getSnapshot().value).toBe("Closed");
      });
    });

    describe("VIP Booking Flow", () => {
      it("should transition XState to Services Request for VIP with services", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-vip-789",
          requestNumber: 12347,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "REQUESTED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "VIP Test Booking",
          description: "VIP Test Description",
          roomId: "224",
          department: "IDM",
          role: "Faculty",
        });

        // VIP booking with services
        const context = {
          tenant: testTenant,
          selectedRooms: [{ roomId: "224", shouldAutoApprove: true }],
          servicesRequested: {
            cleaning: true,
            setup: true,
          },
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: false,
          isVip: true,
        };

        // Use the real XState machine
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // Should go to Services Request state (not auto-approved due to services)
        const snapshot = actor.getSnapshot();
        expect(snapshot.value).toEqual(
          expect.objectContaining({
            "Services Request": expect.any(Object),
          })
        );
        expect(snapshot.context.isVip).toBe(true);
        expect(snapshot.context.servicesRequested?.cleaning).toBe(true);
        expect(snapshot.context.servicesRequested?.setup).toBe(true);

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Test service approval flow
        actor.send({ type: "approveCleaning" });
        actor.send({ type: "approveSetup" });

        // After all services approved, should reach Approved
        const finalSnapshot = actor.getSnapshot();
        expect(finalSnapshot.context.servicesApproved?.cleaning).toBe(true);
        expect(finalSnapshot.context.servicesApproved?.setup).toBe(true);
        expect(finalSnapshot.value).toBe("Approved");

        // Test integration: XState reaches Approved, then manual /api/approve processing for VIP
        vi.clearAllMocks();

        // Import and call finalApprove to simulate what /api/approve does when XState reaches "Approved"
        const { finalApprove } = await import("@/components/src/server/admin");

        // Call finalApprove (this is what /api/approve does when XState reaches "Approved")
        await finalApprove(testCalendarEventId, testEmail, testTenant);

        // Verify that finalApprove actually called logServerBookingChange for APPROVED status
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "APPROVED",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "",
          })
        );

        // Test that noShow event is not handled in Services Request state
        // This is expected behavior - services must be processed first
        vi.clearAllMocks();

        // Create a new VIP actor that starts in Services Request
        const vipServicesContext = {
          tenant: testTenant,
          selectedRooms: [{ roomId: "224", shouldAutoApprove: true }],
          servicesRequested: {
            cleaning: true,
            setup: true,
          },
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: false,
          isVip: true,
        };

        const vipActor = createActor(mcBookingMachine, {
          input: vipServicesContext,
        });
        vipActor.start();

        // Should be in Services Request state
        const servicesSnapshot = vipActor.getSnapshot();
        expect(servicesSnapshot.value).toEqual(
          expect.objectContaining({
            "Services Request": expect.any(Object),
          })
        );

        // Try to send noShow event - should not transition or call logBookingHistory
        vipActor.send({ type: "noShow" });

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Should still be in Services Request state (noShow not handled)
        const afterNoShowSnapshot = vipActor.getSnapshot();
        expect(afterNoShowSnapshot.value).toEqual(
          expect.objectContaining({
            "Services Request": expect.any(Object),
          })
        );

        // logBookingHistory should not have been called since noShow wasn't processed
        expect(mockLogServerBookingChange).not.toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
          })
        );
      });
    });

    describe("Walk-in Booking Flow", () => {
      it("should auto-approve walk-in bookings regardless of services", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-walkin-101",
          requestNumber: 12348,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "REQUESTED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "Walk-in Test Booking",
          description: "Walk-in Test Description",
          roomId: "224",
          department: "IDM",
          role: "Student",
        });

        // Walk-in with services - should still auto-approve
        const context = {
          tenant: testTenant,
          selectedRooms: [{ roomId: "224", shouldAutoApprove: false }],
          servicesRequested: {
            cleaning: true,
            equipment: true,
          },
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: true, // Key difference - walk-ins auto-approve
          isVip: false,
        };

        // Use the real XState machine
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // Walk-ins should auto-approve even with services
        expect(actor.getSnapshot().value).toBe("Approved");
        expect(actor.getSnapshot().context.isWalkIn).toBe(true);
        expect(actor.getSnapshot().context.servicesRequested?.cleaning).toBe(
          true
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify that XState reached the correct final state
        expect(actor.getSnapshot().value).toBe("Approved");
        expect(actor.getSnapshot().context.isWalkIn).toBe(true);
        expect(actor.getSnapshot().context.servicesRequested?.cleaning).toBe(
          true
        );

        // Test integration: XState reaches Approved, then manual /api/approve processing for Walk-in
        vi.clearAllMocks();

        // Import and call finalApprove to simulate what /api/approve does when XState reaches "Approved"
        const { finalApprove } = await import("@/components/src/server/admin");

        // Call finalApprove (this is what /api/approve does when XState reaches "Approved")
        await finalApprove(testCalendarEventId, testEmail, testTenant);

        // Verify that finalApprove actually called logServerBookingChange for APPROVED status
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "APPROVED",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "",
          })
        );

        // Also test XState's own logBookingHistory action with No Show
        vi.clearAllMocks();

        // Simulate no show scenario to test XState's logBookingHistory action
        actor.send({ type: "noShow" });

        // Wait for async logBookingHistory action to complete
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Verify that XState's logBookingHistory action called mockLogServerBookingChange
        expect(mockLogServerBookingChange).toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
            changedBy: testEmail,
            calendarEventId: testCalendarEventId,
            note: "Booking marked as no show",
          })
        );

        // Verify final state after no show
        expect(actor.getSnapshot().value).toBe("Closed");
      });
    });

    describe("Check-In Flow", () => {
      it("should handle user check-in from Approved state and trigger real side effects", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-checkin-555",
          requestNumber: 12350,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "APPROVED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "Check-in Test Booking",
          description: "Test Description",
          roomId: "224",
          department: "IDM",
          role: "Student",
        });

        // Create booking context that starts in Approved state
        const context = {
          tenant: testTenant,
          selectedRooms: [{ 
            roomId: "224", 
            autoApproval: {
              minHour: { admin: -1, faculty: -1, student: -1 },
              maxHour: { admin: -1, faculty: -1, student: -1 },
              conditions: {
                setup: false,
                equipment: false,
                staffing: false,
                catering: false,
                cleaning: false,
                security: false,
              }
            }
          }],
          servicesRequested: {},
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: false,
          isVip: false,
          _restoredFromStatus: true, // Start from existing status
        };

        // Use the ACTUAL XState machine without any modifications
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // First, transition to Approved state (simulate existing approved booking)
        // Need two approves: Requested -> Pre-approved -> Approved
        if (actor.getSnapshot().value !== "Approved") {
          actor.send({ type: "approve" }); // Requested -> Pre-approved
          if (actor.getSnapshot().value !== "Approved") {
            actor.send({ type: "approve" }); // Pre-approved -> Approved
          }
        }

        // Verify we're in Approved state
        expect(actor.getSnapshot().value).toBe("Approved");

        // Simulate user check-in
        actor.send({ type: "checkIn" });

        // Should transition to Checked In state
        expect(actor.getSnapshot().value).toBe("Checked In");
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Wait for async actions to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify XState reached the correct state and context is preserved
        expect(actor.getSnapshot().value).toBe("Checked In");
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Note: For Checked In state, XState actions are placeholders (console.log only)
        // Real side effects (emails, calendar updates, logs) are handled by external processing
        // via /api/checkin or similar endpoints

        // Test that noShow event is not handled in Checked In state
        // This is expected behavior - once checked in, noShow is not applicable
        vi.clearAllMocks();

        // Try to send noShow event from Checked In state - should not be processed
        actor.send({ type: "noShow" });

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Should still be in Checked In state (noShow not handled)
        expect(actor.getSnapshot().value).toBe("Checked In");

        // logBookingHistory should not have been called since noShow wasn't processed
        expect(mockLogServerBookingChange).not.toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
          })
        );
      });

      it("should handle check-in for walk-in bookings using real XState machine", async () => {
        const { mcBookingMachine } = await import(
          "@/lib/stateMachines/mcBookingMachine"
        );

        // Setup mock booking data for walk-in
        mockServerGetDataByCalendarEventId.mockResolvedValue({
          id: "booking-walkin-checkin-666",
          requestNumber: 12351,
          email: testEmail,
          calendarEventId: testCalendarEventId,
          status: "APPROVED",
          startDate: { toDate: () => new Date("2024-01-15T10:00:00Z") },
          endDate: { toDate: () => new Date("2024-01-15T12:00:00Z") },
          title: "Walk-in Check-in Test Booking",
          description: "Walk-in Test Description",
          roomId: "224",
          department: "IDM",
          role: "Student",
        });

        // Walk-in booking context that auto-approves
        const context = {
          tenant: testTenant,
          selectedRooms: [{ roomId: "224", shouldAutoApprove: false }],
          servicesRequested: {
            cleaning: true,
          },
          email: testEmail,
          calendarEventId: testCalendarEventId,
          isWalkIn: true, // Walk-in auto-approves
          isVip: false,
        };

        // Use the ACTUAL XState machine without any modifications
        const actor = createActor(mcBookingMachine, { input: context });
        actor.start();

        // Walk-ins should auto-approve
        expect(actor.getSnapshot().value).toBe("Approved");

        // Simulate check-in
        actor.send({ type: "checkIn" });

        // Should transition to Checked In
        expect(actor.getSnapshot().value).toBe("Checked In");

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify XState transitioned correctly for walk-in check-in
        expect(actor.getSnapshot().value).toBe("Checked In");
        expect(actor.getSnapshot().context.isWalkIn).toBe(true);
        expect(actor.getSnapshot().context.email).toBe(testEmail);
        expect(actor.getSnapshot().context.calendarEventId).toBe(
          testCalendarEventId
        );

        // Note: For Checked In state, XState actions are placeholders (console.log only)
        // Real side effects (emails, calendar updates, logs) are handled by external processing
        // via /api/checkin or similar endpoints

        // Test that noShow event is not handled in Checked In state
        // This is expected behavior - once checked in, noShow is not applicable
        vi.clearAllMocks();

        // Try to send noShow event from Checked In state - should not be processed
        actor.send({ type: "noShow" });

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Should still be in Checked In state (noShow not handled)
        expect(actor.getSnapshot().value).toBe("Checked In");

        // logBookingHistory should not have been called since noShow wasn't processed
        expect(mockLogServerBookingChange).not.toHaveBeenCalledWith(
          expect.objectContaining({
            status: "NO-SHOW",
          })
        );
      });
    });
  });
});
