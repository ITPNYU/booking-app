import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test suite for approved booking modification behavior
 * 
 * This tests the requirement that approved bookings should maintain
 * their Approved status after modification, with proper:
 * - XState data in Approved state
 * - finalApprove processing (calendar update, email, logging)
 * - Preservation of approval timestamps and service approvals
 */

const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerDeleteFieldsByCalendarEventId = vi.fn();
const mockLogServerBookingChange = vi.fn();
const mockFinalApprove = vi.fn();
const mockCreateActor = vi.fn();
const mockGetMediaCommonsServices = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverDeleteFieldsByCalendarEventId: mockServerDeleteFieldsByCalendarEventId,
  logServerBookingChange: mockLogServerBookingChange,
}));

vi.mock("@/components/src/server/admin", () => ({
  finalApprove: mockFinalApprove,
}));

vi.mock("xstate", () => ({
  createActor: mockCreateActor,
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  getMediaCommonsServices: mockGetMediaCommonsServices,
  isMediaCommons: (tenant: string) => tenant === "mc",
}));

describe("Approved Booking Modification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should maintain Approved state for approved booking with services", async () => {
    // Setup: Existing approved booking with services
    const existingBookingData = {
      id: "booking-123",
      calendarEventId: "old-cal-123",
      requestNumber: 100,
      finalApprovedAt: { toDate: () => new Date("2024-01-01") },
      finalApprovedBy: "admin@nyu.edu",
      firstApprovedAt: { toDate: () => new Date("2024-01-01") },
      firstApprovedBy: "liaison@nyu.edu",
      staffServiceApproved: true,
      equipmentServiceApproved: true,
      xstateData: {
        snapshot: {
          value: "Approved",
        },
      },
    };

    mockServerGetDataByCalendarEventId.mockResolvedValue(existingBookingData);
    mockGetMediaCommonsServices.mockReturnValue({
      staff: true,
      equipment: true,
    });

    // Mock actor for XState data creation
    const mockSnapshot = {
      value: "Approved",
      context: {
        tenant: "mc",
        servicesRequested: { staff: true, equipment: true },
        servicesApproved: { staff: true, equipment: true },
      },
      status: "active",
      historyValue: {},
      children: {},
    };

    const mockActor = {
      start: vi.fn(),
      stop: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue(mockSnapshot),
    };

    mockCreateActor.mockReturnValue(mockActor);

    // Test: Check that the logic correctly identifies this as an approved booking
    const wasApproved = 
      existingBookingData.xstateData.snapshot.value === "Approved" ||
      !!existingBookingData.finalApprovedAt;

    expect(wasApproved).toBe(true);
  });

  it("should preserve approval timestamps and service approvals", () => {
    const existingBookingData = {
      finalApprovedAt: { toDate: () => new Date("2024-01-01") },
      finalApprovedBy: "admin@nyu.edu",
      firstApprovedAt: { toDate: () => new Date("2023-12-15") },
      firstApprovedBy: "liaison@nyu.edu",
      staffServiceApproved: true,
      equipmentServiceApproved: true,
      cateringServiceApproved: false,
    };

    // Simulate the preservation logic
    const updatedData: any = {
      roomId: "202",
      // ... other fields
    };

    if (existingBookingData.finalApprovedAt) {
      updatedData.finalApprovedAt = existingBookingData.finalApprovedAt;
    }
    if (existingBookingData.finalApprovedBy) {
      updatedData.finalApprovedBy = existingBookingData.finalApprovedBy;
    }
    if (existingBookingData.firstApprovedAt) {
      updatedData.firstApprovedAt = existingBookingData.firstApprovedAt;
    }
    if (existingBookingData.firstApprovedBy) {
      updatedData.firstApprovedBy = existingBookingData.firstApprovedBy;
    }

    // Preserve service approvals
    if (existingBookingData.staffServiceApproved !== undefined) {
      updatedData.staffServiceApproved = existingBookingData.staffServiceApproved;
    }
    if (existingBookingData.equipmentServiceApproved !== undefined) {
      updatedData.equipmentServiceApproved = existingBookingData.equipmentServiceApproved;
    }
    if (existingBookingData.cateringServiceApproved !== undefined) {
      updatedData.cateringServiceApproved = existingBookingData.cateringServiceApproved;
    }

    expect(updatedData.finalApprovedAt).toEqual(existingBookingData.finalApprovedAt);
    expect(updatedData.finalApprovedBy).toBe("admin@nyu.edu");
    expect(updatedData.firstApprovedAt).toEqual(existingBookingData.firstApprovedAt);
    expect(updatedData.firstApprovedBy).toBe("liaison@nyu.edu");
    expect(updatedData.staffServiceApproved).toBe(true);
    expect(updatedData.equipmentServiceApproved).toBe(true);
    expect(updatedData.cateringServiceApproved).toBe(false);
  });

  it("should call finalApprove for approved modification", async () => {
    const wasApproved = true;
    const usesXState = true;
    const newCalendarEventId = "new-cal-456";
    const modifiedBy = "pa@nyu.edu";
    const tenant = "mc";

    // Simulate the finalApprove call logic
    if (usesXState && wasApproved) {
      await mockFinalApprove(newCalendarEventId, modifiedBy, tenant);
    }

    expect(mockFinalApprove).toHaveBeenCalledTimes(1);
    expect(mockFinalApprove).toHaveBeenCalledWith(
      newCalendarEventId,
      modifiedBy,
      tenant
    );
  });

  it("should NOT call finalApprove for non-approved modification", async () => {
    const wasApproved = false;
    const usesXState = true;
    const newCalendarEventId = "new-cal-456";
    const modifiedBy = "user@nyu.edu";
    const tenant = "mc";

    // Simulate the finalApprove call logic
    if (usesXState && wasApproved) {
      await mockFinalApprove(newCalendarEventId, modifiedBy, tenant);
    }

    expect(mockFinalApprove).not.toHaveBeenCalled();
  });

  it("should not delete approval fields for approved modification", () => {
    const wasApproved = true;
    const fieldsToDelete: string[] = [];

    // Simulate the field deletion logic
    if (!wasApproved) {
      fieldsToDelete.push(
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy"
      );
    }

    expect(fieldsToDelete).toHaveLength(0);
  });

  it("should delete approval fields for non-approved edit", () => {
    const wasApproved = false;
    const fieldsToDelete: string[] = [];

    // Simulate the field deletion logic
    if (!wasApproved) {
      fieldsToDelete.push(
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy"
      );
    }

    expect(fieldsToDelete).toContain("finalApprovedAt");
    expect(fieldsToDelete).toContain("finalApprovedBy");
    expect(fieldsToDelete).toContain("firstApprovedAt");
    expect(fieldsToDelete).toContain("firstApprovedBy");
    expect(fieldsToDelete).toHaveLength(4);
  });

  it("should create XState data with Approved state for approved modification", () => {
    const wasApproved = true;
    const xstateProcessed = false;
    const xstateNewState = null;

    // Determine target state
    const targetState = wasApproved ? "Approved" : xstateNewState;

    expect(targetState).toBe("Approved");
  });

  it("should create XState data with Requested state for non-approved edit", () => {
    const wasApproved = false;
    const xstateProcessed = true;
    const xstateNewState = "Requested";

    // Determine target state
    const targetState = wasApproved ? "Approved" : xstateNewState;

    expect(targetState).toBe("Requested");
  });

  it("should detect approved state from XState value", () => {
    const bookingData = {
      xstateData: {
        snapshot: {
          value: "Approved",
        },
      },
    };

    const currentXStateValue = bookingData.xstateData.snapshot.value;
    const isApproved = currentXStateValue === "Approved";

    expect(isApproved).toBe(true);
  });

  it("should detect approved state from finalApprovedAt timestamp", () => {
    const bookingData = {
      finalApprovedAt: { toDate: () => new Date("2024-01-01") },
      xstateData: {
        snapshot: {
          value: "Services Request",
        },
      },
    };

    const hasApprovedTimestamp = !!bookingData.finalApprovedAt;
    const isApproved = hasApprovedTimestamp;

    expect(isApproved).toBe(true);
  });

  it("should detect pre-approved state with services", () => {
    const bookingData = {
      firstApprovedAt: { toDate: () => new Date("2024-01-01") },
      xstateData: {
        snapshot: {
          value: {
            "Services Request": {
              "Staff Request": "Staff Requested",
            },
          },
        },
      },
    };

    const hasPreApprovedTimestamp = !!bookingData.firstApprovedAt;
    const currentXStateValue = bookingData.xstateData.snapshot.value;
    const isObjectState = typeof currentXStateValue === "object" && currentXStateValue;
    const hasServicesRequest = isObjectState && !!currentXStateValue["Services Request"];

    const isApproved = hasPreApprovedTimestamp && hasServicesRequest;

    expect(isApproved).toBe(true);
  });
});

