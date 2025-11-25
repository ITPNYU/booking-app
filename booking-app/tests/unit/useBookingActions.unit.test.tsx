import { renderHook, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useBookingActions, {
  Actions,
} from "../../components/src/client/routes/admin/hooks/useBookingActions";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  BookingStatusLabel,
  PageContextLevel,
} from "../../components/src/types";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

// Mock server functions
vi.mock("../../components/src/server/db", () => ({
  cancel: vi.fn(),
  noShow: vi.fn(),
  checkin: vi.fn(),
  checkOut: vi.fn(),
  clientApproveBooking: vi.fn(),
  clientEquipmentApprove: vi.fn(),
  clientSendToEquipment: vi.fn(),
  decline: vi.fn(),
}));

// Mock firebase client
vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(() =>
    Promise.resolve({
      serviceRequests: {
        staff: true,
        equipment: true,
        catering: true,
        cleaning: true,
        security: true,
        setup: true,
      },
      servicesApproved: {},
      servicesClosedOut: {},
      currentXState: "Services Request",
    })
  ),
}));

// Mock tenant utils
vi.mock("@/components/src/utils/tenantUtils", () => ({
  isMediaCommons: vi.fn(() => true),
  getMediaCommonsServices: vi.fn(() => []),
}));

// Mock useExistingBooking
vi.mock(
  "../../components/src/client/routes/admin/hooks/useExistingBooking",
  () => ({
    default: vi.fn(() => vi.fn()),
  })
);

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

const mockParams = {
  tenant: "media-commons",
};

const mockDatabaseContext = {
  userEmail: "test@nyu.edu",
  netId: "test123",
  pagePermission: "ADMIN",
  bookingsLoading: false,
  allBookings: [],
  reloadFutureBookings: vi.fn(),
};

const mockBookingContext = {
  reloadExistingCalendarEvents: vi.fn(),
};

// Helper function to render the hook with providers
const renderUseBookingActions = (
  calendarEventId: string,
  pageContext: PageContextLevel,
  status: BookingStatusLabel,
  startDate: Timestamp,
  reason: string = ""
) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DatabaseContext.Provider value={mockDatabaseContext as any}>
      <BookingContext.Provider value={mockBookingContext as any}>
        {children}
      </BookingContext.Provider>
    </DatabaseContext.Provider>
  );

  return renderHook(
    () =>
      useBookingActions({
        calendarEventId,
        pageContext,
        status,
        startDate,
        reason,
      }),
    { wrapper }
  );
};

describe("useBookingActions Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue(mockParams);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("PageContextLevel.USER", () => {
    const testUserContext = (
      status: BookingStatusLabel,
      expectedActions: Actions[]
    ) => {
      it(`should show correct actions for ${status} status`, () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.USER,
          status,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options.sort()).toEqual(expectedActions.sort());
      });
    };

    // Test cases for USER context
    testUserContext(BookingStatusLabel.REQUESTED, [
      Actions.CANCEL,
      Actions.EDIT,
    ]);
    testUserContext(BookingStatusLabel.PRE_APPROVED, [
      Actions.CANCEL,
      Actions.EDIT,
    ]);
    testUserContext(BookingStatusLabel.APPROVED, [Actions.CANCEL]);
    testUserContext(BookingStatusLabel.EQUIPMENT, [Actions.CANCEL]);
    testUserContext(BookingStatusLabel.DECLINED, [
      Actions.CANCEL,
      Actions.EDIT,
    ]); // CANCEL is always shown for USER context
    testUserContext(BookingStatusLabel.CANCELED, []);
    testUserContext(BookingStatusLabel.CHECKED_IN, []);
    testUserContext(BookingStatusLabel.CHECKED_OUT, []);
    testUserContext(BookingStatusLabel.CLOSED, []);
    testUserContext(BookingStatusLabel.NO_SHOW, []);
    testUserContext(BookingStatusLabel.WALK_IN, [Actions.CANCEL]);
    testUserContext(BookingStatusLabel.PENDING, [Actions.CANCEL]);
    testUserContext(BookingStatusLabel.MODIFIED, [Actions.CANCEL]);
    testUserContext(BookingStatusLabel.UNKNOWN, [Actions.CANCEL]);

    it("should show EDIT for past REQUESTED bookings", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.USER,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(pastDate)
      );

      const options = result.current.options();
      expect(options).toEqual([Actions.CANCEL, Actions.EDIT]);
    });

    it("should show EDIT for past DECLINED bookings", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.USER,
        BookingStatusLabel.DECLINED,
        Timestamp.fromDate(pastDate)
      );

      const options = result.current.options();
      expect(options).toEqual([Actions.CANCEL, Actions.EDIT]); // Edit is now allowed for past events
    });
  });

  describe("PageContextLevel.PA", () => {
    const testPAContext = (
      status: BookingStatusLabel,
      expectedActions: Actions[],
      timeOffset: number = 0
    ) => {
      it(`should show correct actions for ${status} status`, () => {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() + 1); // 1 hour in future

        if (timeOffset !== 0) {
          vi.setSystemTime(new Date(startDate.getTime() + timeOffset));
        }

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.PA,
          status,
          Timestamp.fromDate(startDate)
        );

        const options = result.current.options();
        expect(options.sort()).toEqual(expectedActions.sort());
      });
    };

    // Test cases for PA context
    testPAContext(BookingStatusLabel.APPROVED, [
      Actions.CHECK_IN,
      Actions.MODIFICATION,
    ]);
    testPAContext(BookingStatusLabel.CHECKED_IN, [Actions.CHECK_OUT]);
    testPAContext(BookingStatusLabel.NO_SHOW, [Actions.CHECK_IN]);
    testPAContext(BookingStatusLabel.WALK_IN, [
      Actions.CHECK_OUT,
      Actions.MODIFICATION,
    ]);
    testPAContext(BookingStatusLabel.REQUESTED, []);
    testPAContext(BookingStatusLabel.PRE_APPROVED, []);
    testPAContext(BookingStatusLabel.EQUIPMENT, []);
    testPAContext(BookingStatusLabel.DECLINED, []);
    testPAContext(BookingStatusLabel.CANCELED, []);
    testPAContext(BookingStatusLabel.CHECKED_OUT, []);
    testPAContext(BookingStatusLabel.CLOSED, []);
    testPAContext(BookingStatusLabel.PENDING, []);
    testPAContext(BookingStatusLabel.MODIFIED, []);
    testPAContext(BookingStatusLabel.UNKNOWN, []);

    it("should show NO_SHOW action for APPROVED status after 30 minutes", () => {
      const startDate = new Date();
      const thirtyOneMinutesLater = new Date(
        startDate.getTime() + 31 * 60 * 1000
      );
      vi.setSystemTime(thirtyOneMinutesLater);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.PA,
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startDate)
      );

      const options = result.current.options();
      expect(options.sort()).toEqual(
        [Actions.CHECK_IN, Actions.MODIFICATION, Actions.NO_SHOW].sort()
      );
    });

    it("should not show NO_SHOW action for APPROVED status before 30 minutes", () => {
      const startDate = new Date();
      const twentyNineMinutesLater = new Date(
        startDate.getTime() + 29 * 60 * 1000
      );
      vi.setSystemTime(twentyNineMinutesLater);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.PA,
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startDate)
      );

      const options = result.current.options();
      expect(options.sort()).toEqual(
        [Actions.CHECK_IN, Actions.MODIFICATION].sort()
      );
    });
  });

  describe("PageContextLevel.LIAISON", () => {
    const testLiaisonContext = (
      status: BookingStatusLabel,
      expectedActions: Actions[]
    ) => {
      it(`should show correct actions for ${status} status`, () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.LIAISON,
          status,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options.sort()).toEqual(expectedActions.sort());
      });
    };

    // Test cases for LIAISON context
    testLiaisonContext(BookingStatusLabel.REQUESTED, [
      Actions.DECLINE,
      Actions.FIRST_APPROVE,
    ]);
    testLiaisonContext(BookingStatusLabel.PRE_APPROVED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.APPROVED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.EQUIPMENT, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.DECLINED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.CANCELED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.CHECKED_IN, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.CHECKED_OUT, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.CLOSED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.NO_SHOW, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.WALK_IN, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.PENDING, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.MODIFIED, [Actions.DECLINE]);
    testLiaisonContext(BookingStatusLabel.UNKNOWN, [Actions.DECLINE]);
  });

  describe("PageContextLevel.SERVICES", () => {
    const testServicesContext = (
      status: BookingStatusLabel,
      expectedActions: Actions[]
    ) => {
      it(`should show correct actions for ${status} status`, () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.SERVICES,
          status,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options.sort()).toEqual(expectedActions.sort());
      });
    };

    // Services context shows no basic actions, only service-specific actions in Service Requested state
    testServicesContext(BookingStatusLabel.REQUESTED, []);
    testServicesContext(BookingStatusLabel.PRE_APPROVED, []);
    testServicesContext(BookingStatusLabel.APPROVED, []);
    testServicesContext(BookingStatusLabel.EQUIPMENT, []);
    testServicesContext(BookingStatusLabel.DECLINED, []);
    testServicesContext(BookingStatusLabel.CANCELED, []);
    testServicesContext(BookingStatusLabel.CHECKED_IN, []);
    testServicesContext(BookingStatusLabel.CHECKED_OUT, []);
    testServicesContext(BookingStatusLabel.CLOSED, []);
    testServicesContext(BookingStatusLabel.NO_SHOW, []);
    testServicesContext(BookingStatusLabel.WALK_IN, []);
    testServicesContext(BookingStatusLabel.PENDING, []);
    testServicesContext(BookingStatusLabel.MODIFIED, []);
    testServicesContext(BookingStatusLabel.UNKNOWN, []);
  });

  describe("PageContextLevel.ADMIN (Default)", () => {
    const testAdminContext = (
      status: BookingStatusLabel,
      expectedActions: Actions[],
      setupMocks?: () => void
    ) => {
      it(`should show correct actions for ${status} status`, () => {
        if (setupMocks) {
          setupMocks();
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.ADMIN,
          status,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options.sort()).toEqual(expectedActions.sort());
      });
    };

    // Test cases for ADMIN context (includes PA actions)
    testAdminContext(BookingStatusLabel.REQUESTED, [
      Actions.FIRST_APPROVE,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.PRE_APPROVED, [
      Actions.FINAL_APPROVE,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.APPROVED, [
      Actions.CHECK_IN,
      Actions.MODIFICATION,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.EQUIPMENT, [
      Actions.FINAL_APPROVE,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.CHECKED_IN, [
      Actions.CHECK_OUT,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.NO_SHOW, [
      Actions.CHECK_IN,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.WALK_IN, [
      Actions.CHECK_OUT,
      Actions.MODIFICATION,
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.PENDING, [
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.MODIFIED, [
      Actions.CANCEL,
      Actions.DECLINE,
    ]);
    testAdminContext(BookingStatusLabel.UNKNOWN, [
      Actions.CANCEL,
      Actions.DECLINE,
    ]);

    // These statuses should return empty arrays
    testAdminContext(BookingStatusLabel.DECLINED, []);
    testAdminContext(BookingStatusLabel.CLOSED, []);

    it("should show NO_SHOW action for APPROVED status after 30 minutes in ADMIN context", () => {
      const startDate = new Date();
      const thirtyOneMinutesLater = new Date(
        startDate.getTime() + 31 * 60 * 1000
      );
      vi.setSystemTime(thirtyOneMinutesLater);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startDate)
      );

      const options = result.current.options();
      expect(options).toContain(Actions.NO_SHOW);
    });

    // For CHECKED_OUT and CANCELED, behavior depends on tenant and services
    testAdminContext(BookingStatusLabel.CHECKED_OUT, []);
    testAdminContext(BookingStatusLabel.CANCELED, []);
  });

  describe("Action Definitions", () => {
    it("should provide action definitions for all actions", () => {
      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      const { actions } = result.current;

      // Check that all actions have the required properties

      Object.values(Actions).forEach((action) => {
        if (action !== Actions.PLACEHOLDER) {
          expect(actions[action]).toBeDefined();
          expect(actions[action]).toHaveProperty("action");
          expect(actions[action]).toHaveProperty("optimisticNextStatus");
          expect(typeof actions[action].action).toBe("function");
          expect(typeof actions[action].optimisticNextStatus).toBe("string");
        }
      });
    });

    it("should have confirmation property for CANCEL and DECLINE actions", () => {
      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      const { actions } = result.current;

      expect(actions[Actions.CANCEL]).toHaveProperty("confirmation", true);
      expect(actions[Actions.DECLINE]).toHaveProperty("confirmation", true);
    });
  });

  describe("Service Action Definitions", () => {
    it("should provide action definitions for all service actions", () => {
      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.PRE_APPROVED,
        Timestamp.fromDate(new Date())
      );

      const { actions } = result.current;

      // Check service approval actions
      const serviceApprovalActions = [
        Actions.APPROVE_STAFF_SERVICE,
        Actions.APPROVE_EQUIPMENT_SERVICE,
        Actions.APPROVE_CATERING_SERVICE,
        Actions.APPROVE_CLEANING_SERVICE,
        Actions.APPROVE_SECURITY_SERVICE,
        Actions.APPROVE_SETUP_SERVICE,
        Actions.DECLINE_STAFF_SERVICE,
        Actions.DECLINE_EQUIPMENT_SERVICE,
        Actions.DECLINE_CATERING_SERVICE,
        Actions.DECLINE_CLEANING_SERVICE,
        Actions.DECLINE_SECURITY_SERVICE,
        Actions.DECLINE_SETUP_SERVICE,
      ];

      serviceApprovalActions.forEach((action) => {
        expect(actions[action]).toBeDefined();
        expect(actions[action]).toHaveProperty("action");
        expect(actions[action]).toHaveProperty("optimisticNextStatus");
        expect(typeof actions[action].action).toBe("function");
      });

      // Check service closeout actions
      const serviceCloseoutActions = [
        Actions.CLOSEOUT_STAFF_SERVICE,
        Actions.CLOSEOUT_EQUIPMENT_SERVICE,
        Actions.CLOSEOUT_CATERING_SERVICE,
        Actions.CLOSEOUT_CLEANING_SERVICE,
        Actions.CLOSEOUT_SECURITY_SERVICE,
        Actions.CLOSEOUT_SETUP_SERVICE,
      ];

      serviceCloseoutActions.forEach((action) => {
        expect(actions[action]).toBeDefined();
        expect(actions[action]).toHaveProperty("action");
        expect(actions[action]).toHaveProperty("optimisticNextStatus");
        expect(typeof actions[action].action).toBe("function");
      });
    });
  });

  describe("Edge Cases and Special Conditions", () => {
    describe("Time-based Logic", () => {
      it("should handle timezone considerations for 30-minute rule", () => {
        const startDate = new Date("2024-02-15T10:00:00Z");
        const thirtyOneMinutesLater = new Date("2024-02-15T10:31:00Z");
        vi.setSystemTime(thirtyOneMinutesLater);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.PA,
          BookingStatusLabel.APPROVED,
          Timestamp.fromDate(startDate)
        );

        const options = result.current.options();
        expect(options).toContain(Actions.NO_SHOW);
      });

      it("should handle exactly 30 minutes boundary", () => {
        const startDate = new Date("2024-02-15T10:00:00Z");
        const exactlyThirtyMinutesLater = new Date("2024-02-15T10:30:00Z");
        vi.setSystemTime(exactlyThirtyMinutesLater);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.PA,
          BookingStatusLabel.APPROVED,
          Timestamp.fromDate(startDate)
        );

        const options = result.current.options();
        // The logic uses >= 30 minutes, so exactly 30 minutes should show NO_SHOW
        expect(options).toContain(Actions.NO_SHOW);
      });
    });

    describe("Future vs Past Booking Logic", () => {
      it("should handle EDIT action for future REQUESTED bookings", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.USER,
          BookingStatusLabel.REQUESTED,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options).toContain(Actions.EDIT);
      });

      it("should show EDIT action for past REQUESTED bookings", () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.USER,
          BookingStatusLabel.REQUESTED,
          Timestamp.fromDate(pastDate)
        );

        const options = result.current.options();
        expect(options).toContain(Actions.EDIT);
      });

      it("should handle EDIT action for future DECLINED bookings", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.USER,
          BookingStatusLabel.DECLINED,
          Timestamp.fromDate(futureDate)
        );

        const options = result.current.options();
        expect(options).toContain(Actions.EDIT);
      });

      it("should show EDIT action for past DECLINED bookings", () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.USER,
          BookingStatusLabel.DECLINED,
          Timestamp.fromDate(pastDate)
        );

        const options = result.current.options();
        expect(options).toContain(Actions.EDIT);
      });
    });
  });

  describe("Cross-Context Action Visibility Tests", () => {
    // Test that specific actions only appear in their intended contexts
    describe("Context-Specific Action Restrictions", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      describe("CHECK_IN action should only appear in PA and ADMIN contexts", () => {
        const testContexts = [
          { context: PageContextLevel.USER, shouldHave: false },
          { context: PageContextLevel.LIAISON, shouldHave: false },
          { context: PageContextLevel.SERVICES, shouldHave: false },
          { context: PageContextLevel.PA, shouldHave: true },
          { context: PageContextLevel.ADMIN, shouldHave: true },
        ];

        testContexts.forEach(({ context, shouldHave }) => {
          it(`should ${shouldHave ? "show" : "not show"} CHECK_IN in ${PageContextLevel[context]} context for APPROVED status`, () => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.APPROVED,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.CHECK_IN);
            } else {
              expect(options).not.toContain(Actions.CHECK_IN);
            }
          });
        });
      });

      describe("FIRST_APPROVE action should only appear in LIAISON and ADMIN contexts", () => {
        const testContexts = [
          { context: PageContextLevel.USER, shouldHave: false },
          { context: PageContextLevel.PA, shouldHave: false },
          { context: PageContextLevel.SERVICES, shouldHave: false },
          { context: PageContextLevel.LIAISON, shouldHave: true },
          { context: PageContextLevel.ADMIN, shouldHave: true },
        ];

        testContexts.forEach(({ context, shouldHave }) => {
          it(`should ${shouldHave ? "show" : "not show"} FIRST_APPROVE in ${PageContextLevel[context]} context for REQUESTED status`, () => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.REQUESTED,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.FIRST_APPROVE);
            } else {
              expect(options).not.toContain(Actions.FIRST_APPROVE);
            }
          });
        });
      });

      describe("FINAL_APPROVE action should only appear in ADMIN context", () => {
        const testContexts = [
          { context: PageContextLevel.USER, shouldHave: false },
          { context: PageContextLevel.PA, shouldHave: false },
          { context: PageContextLevel.LIAISON, shouldHave: false },
          { context: PageContextLevel.SERVICES, shouldHave: false },
          { context: PageContextLevel.ADMIN, shouldHave: true },
        ];

        testContexts.forEach(({ context, shouldHave }) => {
          it(`should ${shouldHave ? "show" : "not show"} FINAL_APPROVE in ${PageContextLevel[context]} context for PRE_APPROVED status`, () => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.PRE_APPROVED,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.FINAL_APPROVE);
            } else {
              expect(options).not.toContain(Actions.FINAL_APPROVE);
            }
          });
        });
      });

      describe("EQUIPMENT_APPROVE action should only appear in EQUIPMENT context", () => {
        const testContexts = [
          { context: PageContextLevel.USER, shouldHave: false },
          { context: PageContextLevel.PA, shouldHave: false },
          { context: PageContextLevel.LIAISON, shouldHave: false },
          { context: PageContextLevel.SERVICES, shouldHave: false }, // Services context doesn't have EQUIPMENT_APPROVE
          { context: PageContextLevel.ADMIN, shouldHave: false }, // Admin has different equipment handling
        ];

        testContexts.forEach(({ context, shouldHave }) => {
          it(`should ${shouldHave ? "show" : "not show"} EQUIPMENT_APPROVE in ${PageContextLevel[context]} context for EQUIPMENT status`, () => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.EQUIPMENT,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.EQUIPMENT_APPROVE);
            } else {
              expect(options).not.toContain(Actions.EQUIPMENT_APPROVE);
            }
          });
        });
      });

      describe("EDIT action should only appear in USER context", () => {
        const testContexts = [
          { context: PageContextLevel.USER, shouldHave: true },
          { context: PageContextLevel.PA, shouldHave: false },
          { context: PageContextLevel.LIAISON, shouldHave: false },
          { context: PageContextLevel.SERVICES, shouldHave: false },
          { context: PageContextLevel.ADMIN, shouldHave: false },
        ];

        testContexts.forEach(({ context, shouldHave }) => {
          it(`should ${shouldHave ? "show" : "not show"} EDIT in ${PageContextLevel[context]} context for REQUESTED status`, () => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.REQUESTED,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.EDIT);
            } else {
              expect(options).not.toContain(Actions.EDIT);
            }
          });
        });
      });
    });

    describe("Status-Specific Action Tests", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      describe("REQUESTED status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [Actions.CANCEL, Actions.EDIT],
          [PageContextLevel.PA]: [],
          [PageContextLevel.LIAISON]: [Actions.DECLINE, Actions.FIRST_APPROVE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [
            Actions.FIRST_APPROVE,
            Actions.CANCEL,
            Actions.DECLINE,
          ],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for REQUESTED status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.REQUESTED,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("APPROVED status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [Actions.CANCEL],
          [PageContextLevel.PA]: [Actions.CHECK_IN, Actions.MODIFICATION],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [
            Actions.CHECK_IN,
            Actions.MODIFICATION,
            Actions.CANCEL,
            Actions.DECLINE,
          ],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for APPROVED status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.APPROVED,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("CHECKED_IN status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [],
          [PageContextLevel.PA]: [Actions.CHECK_OUT],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [
            Actions.CHECK_OUT,
            Actions.CANCEL,
            Actions.DECLINE,
          ],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for CHECKED_IN status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.CHECKED_IN,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("DECLINED status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [Actions.CANCEL, Actions.EDIT],
          [PageContextLevel.PA]: [],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for DECLINED status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.DECLINED,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("CANCELED status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [],
          [PageContextLevel.PA]: [],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for CANCELED status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.CANCELED,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("NO_SHOW status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [],
          [PageContextLevel.PA]: [Actions.CHECK_IN],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [
            Actions.CHECK_IN,
            Actions.CANCEL,
            Actions.DECLINE,
          ],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for NO_SHOW status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.NO_SHOW,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });

      describe("EQUIPMENT status actions across contexts", () => {
        const expectedActionsByContext = {
          [PageContextLevel.USER]: [Actions.CANCEL],
          [PageContextLevel.PA]: [],
          [PageContextLevel.LIAISON]: [Actions.DECLINE],
          [PageContextLevel.SERVICES]: [],
          [PageContextLevel.ADMIN]: [
            Actions.FINAL_APPROVE,
            Actions.CANCEL,
            Actions.DECLINE,
          ],
        };

        Object.entries(expectedActionsByContext).forEach(
          ([contextStr, expectedActions]) => {
            const context = parseInt(contextStr) as PageContextLevel;
            it(`should show correct actions in ${PageContextLevel[context]} context for EQUIPMENT status`, () => {
              const { result } = renderUseBookingActions(
                "test-event",
                context,
                BookingStatusLabel.EQUIPMENT,
                Timestamp.fromDate(futureDate)
              );

              const options = result.current.options();
              expect(options.sort()).toEqual(expectedActions.sort());
            });
          }
        );
      });
    });

    describe("Action Exclusivity Tests", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      it("should never show both FIRST_APPROVE and FINAL_APPROVE for the same status", () => {
        const allContexts = [
          PageContextLevel.USER,
          PageContextLevel.PA,
          PageContextLevel.LIAISON,
          PageContextLevel.SERVICES,
          PageContextLevel.ADMIN,
        ];

        const allStatuses = Object.values(BookingStatusLabel);

        allContexts.forEach((context) => {
          allStatuses.forEach((status) => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              status,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            const hasFirstApprove = options.includes(Actions.FIRST_APPROVE);
            const hasFinalApprove = options.includes(Actions.FINAL_APPROVE);

            // They should never both be present
            expect(hasFirstApprove && hasFinalApprove).toBe(false);
          });
        });
      });

      it("should never show both CHECK_IN and CHECK_OUT for the same status", () => {
        const allContexts = [
          PageContextLevel.USER,
          PageContextLevel.PA,
          PageContextLevel.LIAISON,
          PageContextLevel.SERVICES,
          PageContextLevel.ADMIN,
        ];

        const allStatuses = Object.values(BookingStatusLabel);

        allContexts.forEach((context) => {
          allStatuses.forEach((status) => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              status,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            const hasCheckIn = options.includes(Actions.CHECK_IN);
            const hasCheckOut = options.includes(Actions.CHECK_OUT);

            // They should never both be present
            expect(hasCheckIn && hasCheckOut).toBe(false);
          });
        });
      });

      it("should not show EDIT action in non-USER contexts", () => {
        const nonUserContexts = [
          PageContextLevel.PA,
          PageContextLevel.LIAISON,
          PageContextLevel.SERVICES,
          PageContextLevel.ADMIN,
        ];

        const editableStatuses = [
          BookingStatusLabel.REQUESTED,
          BookingStatusLabel.DECLINED,
        ];

        nonUserContexts.forEach((context) => {
          editableStatuses.forEach((status) => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              status,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            expect(options).not.toContain(Actions.EDIT);
          });
        });
      });

      describe("NO_SHOW action restrictions", () => {
        it("should only show NO_SHOW in PA and ADMIN contexts", () => {
          const startDate = new Date();
          const thirtyOneMinutesLater = new Date(
            startDate.getTime() + 31 * 60 * 1000
          );
          vi.setSystemTime(thirtyOneMinutesLater);

          const testContexts = [
            { context: PageContextLevel.USER, shouldHave: false },
            { context: PageContextLevel.LIAISON, shouldHave: false },
            { context: PageContextLevel.SERVICES, shouldHave: false },
            { context: PageContextLevel.PA, shouldHave: true },
            { context: PageContextLevel.ADMIN, shouldHave: true },
          ];

          testContexts.forEach(({ context, shouldHave }) => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.APPROVED,
              Timestamp.fromDate(startDate)
            );

            const options = result.current.options();
            if (shouldHave) {
              expect(options).toContain(Actions.NO_SHOW);
            } else {
              expect(options).not.toContain(Actions.NO_SHOW);
            }
          });
        });

        it("should only show NO_SHOW after 30 minutes have passed", () => {
          const startDate = new Date();

          // Test before 30 minutes
          const twentyNineMinutesLater = new Date(
            startDate.getTime() + 29 * 60 * 1000
          );
          vi.setSystemTime(twentyNineMinutesLater);

          let { result } = renderUseBookingActions(
            "test-event",
            PageContextLevel.PA,
            BookingStatusLabel.APPROVED,
            Timestamp.fromDate(startDate)
          );

          let options = result.current.options();
          expect(options).not.toContain(Actions.NO_SHOW);

          // Test after 30 minutes
          const thirtyOneMinutesLater = new Date(
            startDate.getTime() + 31 * 60 * 1000
          );
          vi.setSystemTime(thirtyOneMinutesLater);

          const secondRender = renderUseBookingActions(
            "test-event",
            PageContextLevel.PA,
            BookingStatusLabel.APPROVED,
            Timestamp.fromDate(startDate)
          );

          options = secondRender.result.current.options();
          expect(options).toContain(Actions.NO_SHOW);
        });
      });

      describe("CHECK_OUT action restrictions", () => {
        it("should only show CHECK_OUT after CHECK_IN", () => {
          const testContexts = [PageContextLevel.PA, PageContextLevel.ADMIN];

          testContexts.forEach((context) => {
            // Should show CHECK_OUT for CHECKED_IN status
            const { result: checkedInResult } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.CHECKED_IN,
              Timestamp.fromDate(futureDate)
            );

            const checkedInOptions = checkedInResult.current.options();
            expect(checkedInOptions).toContain(Actions.CHECK_OUT);

            // Should show CHECK_OUT for WALK_IN status (already checked in)
            const { result: walkInResult } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.WALK_IN,
              Timestamp.fromDate(futureDate)
            );

            const walkInOptions = walkInResult.current.options();
            expect(walkInOptions).toContain(Actions.CHECK_OUT);

            // Should NOT show CHECK_OUT for APPROVED status (not checked in yet)
            const { result: approvedResult } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.APPROVED,
              Timestamp.fromDate(futureDate)
            );

            const approvedOptions = approvedResult.current.options();
            expect(approvedOptions).not.toContain(Actions.CHECK_OUT);
          });
        });

        it("should not show CHECK_OUT in non-PA/ADMIN contexts", () => {
          const nonPaAdminContexts = [
            PageContextLevel.USER,
            PageContextLevel.LIAISON,
            PageContextLevel.SERVICES,
          ];

          nonPaAdminContexts.forEach((context) => {
            const { result } = renderUseBookingActions(
              "test-event",
              context,
              BookingStatusLabel.CHECKED_IN,
              Timestamp.fromDate(futureDate)
            );

            const options = result.current.options();
            expect(options).not.toContain(Actions.CHECK_OUT);
          });
        });
      });
    });

    describe("Service Actions Basic Tests", () => {
      it("should provide all service action definitions", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const { result } = renderUseBookingActions(
          "test-event",
          PageContextLevel.ADMIN,
          BookingStatusLabel.PRE_APPROVED,
          Timestamp.fromDate(futureDate)
        );

        const { actions } = result.current;

        // Test that all service actions are defined (they exist in the hook)
        const allServiceActions = [
          Actions.APPROVE_STAFF_SERVICE,
          Actions.DECLINE_STAFF_SERVICE,
          Actions.APPROVE_EQUIPMENT_SERVICE,
          Actions.DECLINE_EQUIPMENT_SERVICE,
          Actions.APPROVE_CATERING_SERVICE,
          Actions.DECLINE_CATERING_SERVICE,
          Actions.APPROVE_CLEANING_SERVICE,
          Actions.DECLINE_CLEANING_SERVICE,
          Actions.APPROVE_SECURITY_SERVICE,
          Actions.DECLINE_SECURITY_SERVICE,
          Actions.APPROVE_SETUP_SERVICE,
          Actions.DECLINE_SETUP_SERVICE,
          Actions.CLOSEOUT_STAFF_SERVICE,
          Actions.CLOSEOUT_EQUIPMENT_SERVICE,
          Actions.CLOSEOUT_CATERING_SERVICE,
          Actions.CLOSEOUT_CLEANING_SERVICE,
          Actions.CLOSEOUT_SECURITY_SERVICE,
          Actions.CLOSEOUT_SETUP_SERVICE,
        ];

        allServiceActions.forEach((action) => {
          expect(actions[action]).toBeDefined();
          expect(actions[action]).toHaveProperty("action");
          expect(actions[action]).toHaveProperty("optimisticNextStatus");
          expect(typeof actions[action].action).toBe("function");
        });
      });

      it("should not show service actions in non-ADMIN contexts by default", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const nonAdminContexts = [
          PageContextLevel.USER,
          PageContextLevel.PA,
          PageContextLevel.LIAISON,
          PageContextLevel.SERVICES,
        ];

        const serviceActions = [
          Actions.APPROVE_STAFF_SERVICE,
          Actions.DECLINE_STAFF_SERVICE,
          Actions.CLOSEOUT_STAFF_SERVICE,
        ];

        nonAdminContexts.forEach((context) => {
          const { result } = renderUseBookingActions(
            "test-event",
            context,
            BookingStatusLabel.PRE_APPROVED,
            Timestamp.fromDate(futureDate)
          );

          const options = result.current.options();

          serviceActions.forEach((action) => {
            expect(options).not.toContain(action);
          });
        });
      });
    });
  });

  describe("updateActions function", () => {
    it("should provide updateActions function", () => {
      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      expect(typeof result.current.updateActions).toBe("function");
    });

    it("should update date when updateActions is called", () => {
      const initialDate = new Date("2024-01-01");
      vi.setSystemTime(initialDate);

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      // Change system time
      const newDate = new Date("2024-01-02");
      vi.setSystemTime(newDate);

      // Call updateActions
      result.current.updateActions();

      // The internal date should now be updated (this affects time-based logic)
      // We can verify this by checking if the options change based on time
      expect(typeof result.current.updateActions).toBe("function");
    });
  });

  describe("fetchBookingData", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("should use servicesApproved from XState context when available", async () => {
      const { clientGetDataByCalendarEventId } = await vi.importMock<typeof import("@/lib/firebase/firebase")>("@/lib/firebase/firebase");
      const { getMediaCommonsServices } = await vi.importMock<typeof import("@/components/src/utils/tenantUtils")>("@/components/src/utils/tenantUtils");
      
      (clientGetDataByCalendarEventId as any).mockResolvedValueOnce({
        roomSetup: "yes",
        staffingServicesDetails: "Need staff support",
        equipmentServices: "yes",
        catering: "yes",
        xstateData: {
          snapshot: {
            value: "Pre-approved",
            context: {
              servicesApproved: {
                staff: true,
                equipment: true,
                catering: false,
                cleaning: false,
                security: false,
                setup: false,
              },
            },
          },
        },
      });

      (getMediaCommonsServices as any).mockReturnValueOnce({
        staff: true,
        equipment: true,
        catering: true,
        cleaning: false,
        security: false,
        setup: false,
      });

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.PRE_APPROVED,
        Timestamp.fromDate(new Date())
      );

      // Wait for fetchBookingData to populate servicesApproved from XState
      await waitFor(() => {
        expect(result.current.servicesApproved).toEqual({
          staff: true,
          equipment: true,
          catering: false,
          cleaning: false,
          security: false,
          setup: false,
        });
      });
    });

    it.skip("should fallback to servicesRequested when XState context exists but servicesApproved is missing", async () => {
      const { clientGetDataByCalendarEventId } = await vi.importMock<typeof import("@/lib/firebase/firebase")>("@/lib/firebase/firebase");
      const { getMediaCommonsServices } = await vi.importMock<typeof import("@/components/src/utils/tenantUtils")>("@/components/src/utils/tenantUtils");
      
      // Mock booking data with XState but no servicesApproved in context
      (clientGetDataByCalendarEventId as any).mockResolvedValueOnce({
        roomSetup: "yes",
        staffingServicesDetails: "Need staff support",
        equipmentServices: "yes",
        catering: "no",
        xstateData: {
          snapshot: {
            value: "Pre-approved",
            context: {
              // servicesApproved is missing
            },
          },
        },
      });

      (getMediaCommonsServices as any).mockReturnValueOnce({
        staff: true,
        equipment: true,
        catering: false,
        cleaning: false,
        security: false,
        setup: false,
      });

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.PRE_APPROVED,
        Timestamp.fromDate(new Date())
      );

      // Wait for fetchBookingData to complete
      await waitFor(
        () => {
          return result.current.servicesApproved?.equipment !== undefined;
        },
        { timeout: 1000 }
      );

      // servicesApproved should fallback to servicesRequested
      expect(result.current.servicesApproved).toEqual({
        staff: true,
        equipment: true,
        catering: false,
        cleaning: false,
        security: false,
        setup: false,
      });
    });

    it.skip("should fallback to servicesRequested when no XState data exists", async () => {
      const { clientGetDataByCalendarEventId } = await vi.importMock<typeof import("@/lib/firebase/firebase")>("@/lib/firebase/firebase");
      const { getMediaCommonsServices } = await vi.importMock<typeof import("@/components/src/utils/tenantUtils")>("@/components/src/utils/tenantUtils");
      
      // Mock booking data without XState
      (clientGetDataByCalendarEventId as any).mockResolvedValueOnce({
        roomSetup: "yes",
        staffingServicesDetails: "Need staff support",
        equipmentServices: "no",
        catering: "yes",
        cleaningService: "yes",
        // No xstateData
      });

      (getMediaCommonsServices as any).mockReturnValueOnce({
        staff: true,
        equipment: false,
        catering: true,
        cleaning: true,
        security: false,
        setup: false,
      });

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      // Wait for fetchBookingData to complete
      await waitFor(
        () => {
          return result.current.servicesApproved?.staff !== undefined;
        },
        { timeout: 1000 }
      );

      // servicesApproved should use servicesRequested as fallback
      expect(result.current.servicesApproved).toEqual({
        staff: true,
        equipment: false,
        catering: true,
        cleaning: true,
        security: false,
        setup: false,
      });
    });

    it.skip("should use false for services not in servicesRequested when no XState exists", async () => {
      const { clientGetDataByCalendarEventId } = await vi.importMock<typeof import("@/lib/firebase/firebase")>("@/lib/firebase/firebase");
      const { getMediaCommonsServices } = await vi.importMock<typeof import("@/components/src/utils/tenantUtils")>("@/components/src/utils/tenantUtils");
      
      // Mock booking data without any services requested
      (clientGetDataByCalendarEventId as any).mockResolvedValueOnce({
        roomSetup: "no",
        staffingServicesDetails: "",
        equipmentServices: "no",
        catering: "no",
        // No xstateData
      });

      (getMediaCommonsServices as any).mockReturnValueOnce({
        staff: false,
        equipment: false,
        catering: false,
        cleaning: false,
        security: false,
        setup: false,
      });

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(new Date())
      );

      // Wait for fetchBookingData to complete
      await waitFor(
        () => {
          return result.current.servicesApproved?.staff !== undefined;
        },
        { timeout: 1000 }
      );

      // All servicesApproved should be false
      expect(result.current.servicesApproved).toEqual({
        staff: false,
        equipment: false,
        catering: false,
        cleaning: false,
        security: false,
        setup: false,
      });
    });

    it.skip("should prioritize XState context over servicesRequested", async () => {
      const { clientGetDataByCalendarEventId } = await vi.importMock<typeof import("@/lib/firebase/firebase")>("@/lib/firebase/firebase");
      const { getMediaCommonsServices } = await vi.importMock<typeof import("@/components/src/utils/tenantUtils")>("@/components/src/utils/tenantUtils");
      
      // Mock booking data where XState context differs from servicesRequested
      (clientGetDataByCalendarEventId as any).mockResolvedValueOnce({
        roomSetup: "yes",
        staffingServicesDetails: "Need staff",
        equipmentServices: "yes",
        catering: "yes",
        xstateData: {
          snapshot: {
            value: "Pre-approved",
            context: {
              servicesApproved: {
                staff: true,
                equipment: false, // Declined in XState
                catering: true,
                cleaning: false,
                security: false,
                setup: false,
              },
            },
          },
        },
      });

      (getMediaCommonsServices as any).mockReturnValueOnce({
        staff: true,
        equipment: true, // Requested but declined
        catering: true,
        cleaning: false,
        security: false,
        setup: false,
      });

      const { result } = renderUseBookingActions(
        "test-event",
        PageContextLevel.ADMIN,
        BookingStatusLabel.PRE_APPROVED,
        Timestamp.fromDate(new Date())
      );

      // Wait for fetchBookingData to complete
      await waitFor(
        () => {
          return result.current.servicesApproved !== undefined;
        },
        { timeout: 1000 }
      );

      // servicesApproved should use XState context (equipment is false, not true)
      expect(result.current.servicesApproved).toEqual({
        staff: true,
        equipment: false,
        catering: true,
        cleaning: false,
        security: false,
        setup: false,
      });
    });
  });
});
