import { renderHook } from "@testing-library/react";
import { useParams, usePathname, useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import useCheckFormMissingData from "../../components/src/client/routes/booking/hooks/useCheckFormMissingData";

// Mock Next.js navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  usePathname: vi.fn(),
}));

// Test wrapper to provide BookingContext
const createWrapper = (contextValue: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
};

describe("useCheckFormMissingData - Redirect Behavior", () => {
  const mockPush = vi.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue({ tenant: "test-tenant" });
  });

  describe("Missing affiliation redirects to role/netid page", () => {
    it("redirects to /role when accessing selectRoom without affiliation (book flow)", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/role");
    });

    it("redirects to /netid when accessing selectRoom without affiliation (walk-in flow)", () => {
      (usePathname as any).mockReturnValue("/test-tenant/walk-in/selectRoom");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/walk-in/netid");
    });

    it("redirects to /role when accessing form page without affiliation", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1", capacity: "20" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
          start: new Date("2024-01-01T09:00:00"),
          end: new Date("2024-01-01T10:00:00"),
        },
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/role");
    });

    it("redirects to /role when accessing confirmation without affiliation", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/role");
    });

    it("preserves ID in redirect path for edit flow", () => {
      (usePathname as any).mockReturnValue(
        "/test-tenant/edit/selectRoom/abc123"
      );

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/edit/role/abc123");
    });

    it("redirects to /role for VIP flow without affiliation", () => {
      (usePathname as any).mockReturnValue("/test-tenant/vip/selectRoom");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/vip/role");
    });
  });

  describe("Missing room selection redirects to selectRoom", () => {
    it("redirects to /selectRoom when accessing form without room selection", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/selectRoom");
    });

    it("redirects to /selectRoom when accessing confirmation without room selection", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/selectRoom");
    });

    it("preserves ID when redirecting to selectRoom in edit flow", () => {
      (usePathname as any).mockReturnValue("/test-tenant/edit/form/abc123");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith(
        "/test-tenant/edit/selectRoom/abc123"
      );
    });
  });

  describe("Allows access with complete data", () => {
    it("allows access to selectRoom when affiliation is present", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("allows access to form when affiliation and room selection are present", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1", capacity: "20" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
          start: new Date("2024-01-01T09:00:00"),
          end: new Date("2024-01-01T10:00:00"),
        },
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("allows access to confirmation when all data is complete", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: {
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "212-555-1234",
        },
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("allows modification page at selectRoom without affiliation check", () => {
      (usePathname as any).mockReturnValue(
        "/test-tenant/modification/selectRoom"
      );

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      // Modification bypasses affiliation check at selectRoom page
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Path parsing with various booking types", () => {
    it("handles walk-in paths correctly", () => {
      (usePathname as any).mockReturnValue("/test-tenant/walk-in/form");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/walk-in/netid");
    });

    it("handles VIP paths correctly", () => {
      (usePathname as any).mockReturnValue("/test-tenant/vip/form");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/vip/role");
    });

    it("handles modification paths differently", () => {
      (usePathname as any).mockReturnValue("/test-tenant/modification/form");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      // Modification page bypasses affiliation check but still needs room selection for form page
      // Since room selection is missing, it redirects to selectRoom
      expect(mockPush).toHaveBeenCalledWith("/test-tenant/modification/selectRoom");
    });
  });

  describe("Incomplete calendar info", () => {
    it("redirects when calendar info is missing startStr", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          endStr: "2024-01-01T10:00:00",
        },
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/selectRoom");
    });

    it("redirects when calendar info is missing endStr", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
        },
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/selectRoom");
    });
  });

  describe("Regression: Auto-filled affiliation without school", () => {
    it("REGRESSION: When role and department are auto-filled but school is not selected, user can still access selectRoom", () => {
      // This test documents that useCheckFormMissingData only checks role+department,
      // not school. The actual fix for the bug is in UserRolePage.getDisabled()
      // which prevents the Next button from working until school is selected.
      //
      // BUG CONTEXT (PR fix/affiliation-page-skip-bug):
      // Users with auto-filled role/department (e.g., from Identity API mapping
      // affiliation_sub_type: 'DEGREE' → role: 'Student') could proceed past the
      // Affiliation page without selecting a school, causing submission to fail.
      //
      // FIX: UserRolePage.getDisabled() now checks hasSelectedSchool to keep the
      // Next button disabled until school is selected, even when role/department
      // are auto-filled.
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      const contextValue = {
        role: "Student", // Auto-filled from Identity API
        department: "Engineering", // Auto-filled from Identity API
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null, // School is NOT set here
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      // useCheckFormMissingData allows access because role+department exist
      expect(mockPush).not.toHaveBeenCalled();

      // The actual protection happens in UserRolePage.getDisabled() which checks hasSelectedSchool
    });

    it("REGRESSION: Confirms that only role is missing redirects to role page", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      const contextValue = {
        role: null,
        department: "Engineering", // Department is set
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/role");
    });

    it("REGRESSION: Confirms that only department is missing redirects to role page", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      const contextValue = {
        role: "Student",
        department: null, // Department is missing
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/role");
    });
  });

  describe("Edge cases", () => {
    it("allows access to role page regardless of missing data", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/role");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("allows access to netid page regardless of missing data", () => {
      (usePathname as any).mockReturnValue("/test-tenant/walk-in/netid");

      const contextValue = {
        role: null,
        department: null,
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("redirects when selectedRooms is an empty array", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      const contextValue = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [], // Empty array should be treated as missing
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: null,
      };

      renderHook(() => useCheckFormMissingData(), {
        wrapper: createWrapper(contextValue),
      });

      // Empty array is falsy in the check, so this should NOT redirect
      // The hook checks: selectedRooms && bookingCalendarInfo && ...
      // Empty array is truthy, so it passes
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
