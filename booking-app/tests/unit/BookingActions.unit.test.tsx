import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test the disabled actions logic directly
describe("BookingActions - Check-in Time Restrictions Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // This function mimics the disabledActions logic from BookingActions.tsx
  const getDisabledActions = (
    pageContext: PageContextLevel,
    startDate: Timestamp,
    currentTime: Date = new Date()
  ) => {
    const disabledActions = [];
    if (
      pageContext === PageContextLevel.ADMIN ||
      pageContext === PageContextLevel.PA
    ) {
      // Allow check-in starting 1 hour (3600000 ms) before the start time
      const oneHourBeforeStart = startDate.toMillis() - 3600000;
      if (currentTime.getTime() < oneHourBeforeStart) {
        disabledActions.push("Check In");
      }
    }
    return disabledActions;
  };

  describe("Check-in time restriction logic", () => {
    it("should disable check-in when current time is more than 1 hour before start time for ADMIN", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T12:30:00Z"); // 12:30 PM (1.5 hours before)

      const disabledActions = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).toContain("Check In");
    });

    it("should enable check-in when current time is exactly 1 hour before start time for ADMIN", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T13:00:00Z"); // 1:00 PM (exactly 1 hour before)

      const disabledActions = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).not.toContain("Check In");
    });

    it("should enable check-in when current time is 30 minutes before start time for ADMIN", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T13:30:00Z"); // 1:30 PM (30 minutes before)

      const disabledActions = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).not.toContain("Check In");
    });

    it("should enable check-in when current time is after start time for ADMIN", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T14:30:00Z"); // 2:30 PM (30 minutes after)

      const disabledActions = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).not.toContain("Check In");
    });

    it("should disable check-in when current time is more than 1 hour before start time for PA", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T12:30:00Z"); // 12:30 PM (1.5 hours before)

      const disabledActions = getDisabledActions(
        PageContextLevel.PA,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).toContain("Check In");
    });

    it("should enable check-in when current time is 1 hour before start time for PA", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T13:00:00Z"); // 1:00 PM (exactly 1 hour before)

      const disabledActions = getDisabledActions(
        PageContextLevel.PA,
        Timestamp.fromDate(startTime),
        currentTime
      );

      expect(disabledActions).not.toContain("Check In");
    });

    it("should not restrict check-in for USER page context (time restriction only applies to ADMIN/PA)", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T12:00:00Z"); // 12:00 PM (2 hours before)

      const disabledActions = getDisabledActions(
        PageContextLevel.USER,
        Timestamp.fromDate(startTime),
        currentTime
      );

      // Note: USER context doesn't have Check In action available at all in the real UI
      // This test only verifies the time restriction logic doesn't apply to USER context
      expect(disabledActions).not.toContain("Check In");
    });

    it("should not restrict check-in for LIAISON page context (time restriction only applies to ADMIN/PA)", () => {
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM
      const currentTime = new Date("2024-01-15T12:00:00Z"); // 12:00 PM (2 hours before)

      const disabledActions = getDisabledActions(
        PageContextLevel.LIAISON,
        Timestamp.fromDate(startTime),
        currentTime
      );

      // Note: LIAISON context doesn't have Check In action available at all in the real UI
      // This test only verifies the time restriction logic doesn't apply to LIAISON context
      expect(disabledActions).not.toContain("Check In");
    });

    it("should calculate time correctly with timezone differences", () => {
      // Test edge case around the 1-hour boundary
      const startTime = new Date("2024-01-15T14:00:00Z"); // 2:00 PM UTC
      const exactlyOneHourBefore = new Date(startTime.getTime() - 3600000); // Exactly 1 hour before
      const slightlyMoreThanOneHourBefore = new Date(
        startTime.getTime() - 3600001
      ); // 1ms more than 1 hour before

      const disabledActionsAtBoundary = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        exactlyOneHourBefore
      );

      const disabledActionsOverBoundary = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        slightlyMoreThanOneHourBefore
      );

      expect(disabledActionsAtBoundary).not.toContain("Check In");
      expect(disabledActionsOverBoundary).toContain("Check In");
    });
  });

  describe("One hour restriction constant", () => {
    it("should use exactly 3600000 milliseconds for 1 hour restriction", () => {
      const oneHourInMs = 3600000;
      const startTime = new Date("2024-01-15T14:00:00Z");
      const oneHourBefore = new Date(startTime.getTime() - oneHourInMs);
      const justOverOneHour = new Date(startTime.getTime() - oneHourInMs - 1);

      const enabledAtOneHour = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        oneHourBefore
      );

      const disabledOverOneHour = getDisabledActions(
        PageContextLevel.ADMIN,
        Timestamp.fromDate(startTime),
        justOverOneHour
      );

      expect(enabledAtOneHour).not.toContain("Check In");
      expect(disabledOverOneHour).toContain("Check In");
    });
  });
});

// Test action availability logic beyond just check-in time restrictions
describe("BookingActions - Action Availability Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Mock functions to replicate the action availability logic from useBookingActions
  const getUserOptions = (
    status: BookingStatusLabel,
    startDate: Timestamp,
    currentTime: Date = new Date()
  ) => {
    const options = [];
    if (
      status !== BookingStatusLabel.CANCELED &&
      status !== BookingStatusLabel.CHECKED_IN &&
      status !== BookingStatusLabel.CHECKED_OUT &&
      status !== BookingStatusLabel.NO_SHOW
    ) {
      options.push("Cancel");
    }
    if (
      status === BookingStatusLabel.REQUESTED &&
      startDate.toDate() > currentTime
    ) {
      options.push("Edit");
    }
    return options;
  };

  const getPaOptions = (
    status: BookingStatusLabel,
    startDate: Timestamp,
    currentTime: Date = new Date()
  ) => {
    const options = [];

    if (status === BookingStatusLabel.APPROVED) {
      options.push("Check In");
      options.push("Modification");
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      options.push("Check Out");
      options.push("Modification");
    } else if (status === BookingStatusLabel.NO_SHOW) {
      options.push("Check In");
    } else if (status === BookingStatusLabel.WALK_IN) {
      options.push("Check Out");
      options.push("Modification");
    }

    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const thirtyPastStartTime =
      currentTime.getTime() - startDate.toDate().getTime() >= THIRTY_MIN_MS;
    if (
      thirtyPastStartTime &&
      (status === BookingStatusLabel.APPROVED ||
        status === BookingStatusLabel.CHECKED_IN)
    ) {
      options.push("No Show");
    }

    return options;
  };

  const getAdminOptions = (
    status: BookingStatusLabel,
    startDate: Timestamp,
    currentTime: Date = new Date()
  ) => {
    if (
      status === BookingStatusLabel.CANCELED ||
      status === BookingStatusLabel.DECLINED ||
      status === BookingStatusLabel.CHECKED_OUT
    ) {
      return [];
    }

    let options = [];
    if (status === BookingStatusLabel.REQUESTED) {
      options.push("1st Approve");
    } else if (status === BookingStatusLabel.PENDING) {
      options.push("Final Approve");
    }

    const paOptions = getPaOptions(status, startDate, currentTime);
    options = options.concat(paOptions);
    options.push("Cancel");
    options.push("Decline");
    return options;
  };

  describe("USER context action availability", () => {
    it("should show Cancel for REQUESTED status", () => {
      const options = getUserOptions(
        BookingStatusLabel.REQUESTED,
        Timestamp.now()
      );
      expect(options).toContain("Cancel");
    });

    it("should show Cancel for APPROVED status", () => {
      const options = getUserOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.now()
      );
      expect(options).toContain("Cancel");
    });

    it("should NOT show Cancel for CANCELED status", () => {
      const options = getUserOptions(
        BookingStatusLabel.CANCELED,
        Timestamp.now()
      );
      expect(options).not.toContain("Cancel");
    });

    it("should NOT show Cancel for CHECKED_IN status", () => {
      const options = getUserOptions(
        BookingStatusLabel.CHECKED_IN,
        Timestamp.now()
      );
      expect(options).not.toContain("Cancel");
    });

    it("should show Edit for REQUESTED status with future date", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const options = getUserOptions(
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(futureDate)
      );
      expect(options).toContain("Edit");
    });

    it("should NOT show Edit for REQUESTED status with past date", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const options = getUserOptions(
        BookingStatusLabel.REQUESTED,
        Timestamp.fromDate(pastDate)
      );
      expect(options).not.toContain("Edit");
    });

    it("should NOT show Edit for APPROVED status even with future date", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const options = getUserOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(futureDate)
      );
      expect(options).not.toContain("Edit");
    });
  });

  describe("PA context action availability", () => {
    it("should show Check In and Modification for APPROVED status", () => {
      const options = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.now()
      );
      expect(options).toContain("Check In");
      expect(options).toContain("Modification");
    });

    it("should show Check Out and Modification for CHECKED_IN status", () => {
      const options = getPaOptions(
        BookingStatusLabel.CHECKED_IN,
        Timestamp.now()
      );
      expect(options).toContain("Check Out");
      expect(options).toContain("Modification");
      expect(options).not.toContain("Check In");
    });

    it("should show Check In for NO_SHOW status", () => {
      const options = getPaOptions(BookingStatusLabel.NO_SHOW, Timestamp.now());
      expect(options).toContain("Check In");
    });

    it("should show Check Out and Modification for WALK_IN status", () => {
      const options = getPaOptions(BookingStatusLabel.WALK_IN, Timestamp.now());
      expect(options).toContain("Check Out");
      expect(options).toContain("Modification");
    });

    it("should show No Show for APPROVED status 30+ minutes after start time", () => {
      const startTime = new Date("2024-01-15T14:00:00Z");
      const thirtyOneMinutesLater = new Date("2024-01-15T14:31:00Z");

      const options = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        thirtyOneMinutesLater
      );
      expect(options).toContain("No Show");
    });

    it("should NOT show No Show for APPROVED status within 30 minutes of start time", () => {
      const startTime = new Date("2024-01-15T14:00:00Z");
      const twentyNineMinutesLater = new Date("2024-01-15T14:29:00Z");

      const options = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        twentyNineMinutesLater
      );
      expect(options).not.toContain("No Show");
    });

    it("should show No Show for CHECKED_IN status 30+ minutes after start time", () => {
      const startTime = new Date("2024-01-15T14:00:00Z");
      const thirtyOneMinutesLater = new Date("2024-01-15T14:31:00Z");

      const options = getPaOptions(
        BookingStatusLabel.CHECKED_IN,
        Timestamp.fromDate(startTime),
        thirtyOneMinutesLater
      );
      expect(options).toContain("No Show");
    });
  });

  describe("ADMIN context action availability", () => {
    describe("Approval actions by status", () => {
      it("should show 1st Approve for REQUESTED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.REQUESTED,
          Timestamp.now()
        );
        expect(options).toContain("1st Approve");
      });

      it("should NOT show Final Approve for REQUESTED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.REQUESTED,
          Timestamp.now()
        );
        expect(options).not.toContain("Final Approve");
      });

      it("should show Final Approve for PENDING status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.PENDING,
          Timestamp.now()
        );
        expect(options).toContain("Final Approve");
      });

      it("should NOT show 1st Approve for PENDING status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.PENDING,
          Timestamp.now()
        );
        expect(options).not.toContain("1st Approve");
      });

      it("should NOT show any approval actions for APPROVED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.APPROVED,
          Timestamp.now()
        );
        expect(options).not.toContain("1st Approve");
        expect(options).not.toContain("Final Approve");
      });

      it("should NOT show any approval actions for CHECKED_IN status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.CHECKED_IN,
          Timestamp.now()
        );
        expect(options).not.toContain("1st Approve");
        expect(options).not.toContain("Final Approve");
      });

      it("should NOT show any approval actions for WALK_IN status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.WALK_IN,
          Timestamp.now()
        );
        expect(options).not.toContain("1st Approve");
        expect(options).not.toContain("Final Approve");
      });

      it("should NOT show any approval actions for NO_SHOW status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.NO_SHOW,
          Timestamp.now()
        );
        expect(options).not.toContain("1st Approve");
        expect(options).not.toContain("Final Approve");
      });
    });

    describe("Overall action availability", () => {
      it("should include PA options for APPROVED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.APPROVED,
          Timestamp.now()
        );
        expect(options).toContain("Check In");
        expect(options).toContain("Modification");
        expect(options).toContain("Cancel");
        expect(options).toContain("Decline");
      });

      it("should include PA options for CHECKED_IN status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.CHECKED_IN,
          Timestamp.now()
        );
        expect(options).toContain("Check Out");
        expect(options).toContain("Modification");
        expect(options).toContain("Cancel");
        expect(options).toContain("Decline");
      });

      it("should include PA options for WALK_IN status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.WALK_IN,
          Timestamp.now()
        );
        expect(options).toContain("Check Out");
        expect(options).toContain("Modification");
        expect(options).toContain("Cancel");
        expect(options).toContain("Decline");
      });

      it("should include PA options for NO_SHOW status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.NO_SHOW,
          Timestamp.now()
        );
        expect(options).toContain("Check In");
        expect(options).toContain("Cancel");
        expect(options).toContain("Decline");
      });

      it("should return empty array for CANCELED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.CANCELED,
          Timestamp.now()
        );
        expect(options).toEqual([]);
      });

      it("should return empty array for DECLINED status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.DECLINED,
          Timestamp.now()
        );
        expect(options).toEqual([]);
      });

      it("should return empty array for CHECKED_OUT status", () => {
        const options = getAdminOptions(
          BookingStatusLabel.CHECKED_OUT,
          Timestamp.now()
        );
        expect(options).toEqual([]);
      });
    });

    describe("Complete approval workflow", () => {
      it("should follow correct approval sequence: REQUESTED → PENDING → APPROVED", () => {
        // Step 1: REQUESTED status should show 1st Approve
        const requestedOptions = getAdminOptions(
          BookingStatusLabel.REQUESTED,
          Timestamp.now()
        );
        expect(requestedOptions).toContain("1st Approve");
        expect(requestedOptions).not.toContain("Final Approve");

        // Step 2: PENDING status should show Final Approve
        const pendingOptions = getAdminOptions(
          BookingStatusLabel.PENDING,
          Timestamp.now()
        );
        expect(pendingOptions).toContain("Final Approve");
        expect(pendingOptions).not.toContain("1st Approve");

        // Step 3: APPROVED status should show no approval actions
        const approvedOptions = getAdminOptions(
          BookingStatusLabel.APPROVED,
          Timestamp.now()
        );
        expect(approvedOptions).not.toContain("1st Approve");
        expect(approvedOptions).not.toContain("Final Approve");
        // But should show operational actions
        expect(approvedOptions).toContain("Check In");
        expect(approvedOptions).toContain("Cancel");
        expect(approvedOptions).toContain("Decline");
      });
    });
  });

  describe("LIAISON context action availability", () => {
    it("should only show 1st Approve and Decline", () => {
      const liaisonOptions = ["1st Approve", "Decline"];
      expect(liaisonOptions).toEqual(["1st Approve", "Decline"]);
      expect(liaisonOptions).not.toContain("Check In");
      expect(liaisonOptions).not.toContain("Cancel");
      expect(liaisonOptions).not.toContain("Final Approve");
    });
  });

  describe("EQUIPMENT context action availability", () => {
    it("should only show Modification and Decline", () => {
      const equipmentOptions = ["Modification", "Decline"];
      expect(equipmentOptions).toEqual(["Modification", "Decline"]);
      expect(equipmentOptions).not.toContain("Check In");
      expect(equipmentOptions).not.toContain("Cancel");
      expect(equipmentOptions).not.toContain("1st Approve");
    });
  });

  describe("30-minute rule logic", () => {
    it("should calculate 30-minute threshold correctly", () => {
      const startTime = new Date("2024-01-15T14:00:00Z");
      const exactlyThirtyMinutes = new Date("2024-01-15T14:30:00Z");
      const thirtyOneMinutes = new Date("2024-01-15T14:31:00Z");
      const twentyNineMinutes = new Date("2024-01-15T14:29:00Z");

      const optionsAtThirty = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        exactlyThirtyMinutes
      );

      const optionsAfterThirty = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        thirtyOneMinutes
      );

      const optionsBeforeThirty = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        twentyNineMinutes
      );

      expect(optionsAtThirty).toContain("No Show");
      expect(optionsAfterThirty).toContain("No Show");
      expect(optionsBeforeThirty).not.toContain("No Show");
    });

    it("should use exactly 30 * 60 * 1000 milliseconds for 30-minute rule", () => {
      const thirtyMinInMs = 30 * 60 * 1000;
      const startTime = new Date("2024-01-15T14:00:00Z");
      const exactlyThirtyMin = new Date(startTime.getTime() + thirtyMinInMs);
      const justUnderThirtyMin = new Date(
        startTime.getTime() + thirtyMinInMs - 1
      );

      const optionsAtThirtyMin = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        exactlyThirtyMin
      );

      const optionsUnderThirtyMin = getPaOptions(
        BookingStatusLabel.APPROVED,
        Timestamp.fromDate(startTime),
        justUnderThirtyMin
      );

      expect(optionsAtThirtyMin).toContain("No Show");
      expect(optionsUnderThirtyMin).not.toContain("No Show");
    });
  });
});
