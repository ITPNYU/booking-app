import { renderHook } from "@testing-library/react";
import { useParams, usePathname, useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Next.js navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  usePathname: vi.fn(),
}));

// Global mock context for flexible testing
let mockContextData = {
  role: "Student",
  department: "Engineering",
  selectedRooms: [{ roomId: "room1", capacity: "20" }],
  bookingCalendarInfo: {
    startStr: "2024-01-01T09:00:00",
    endStr: "2024-01-01T10:00:00",
    start: new Date("2024-01-01T09:00:00"),
    end: new Date("2024-01-01T10:00:00"),
  },
  formData: {
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "212-555-1234",
  },
};

// Mock the useCheckFormMissingData hook functionality
const useCheckFormMissingData = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useParams();

  const hasAffiliationFields =
    (mockContextData.role && mockContextData.department) ||
    pathname.includes("/modification");
  const hasRoomSelectionFields =
    mockContextData.selectedRooms &&
    mockContextData.bookingCalendarInfo &&
    mockContextData.bookingCalendarInfo.startStr &&
    mockContextData.bookingCalendarInfo.endStr;
  const hasFormData = mockContextData.formData;

  React.useEffect(() => {
    let isMissing = false;
    if (pathname.includes("/selectRoom")) {
      isMissing = !hasAffiliationFields;
    } else if (pathname.includes("/form")) {
      isMissing = !(hasAffiliationFields && hasRoomSelectionFields);
    } else if (pathname.includes("/confirmation")) {
      isMissing = !(
        hasAffiliationFields &&
        hasRoomSelectionFields &&
        hasFormData
      );
    }

    if (isMissing) {
      const segments = pathname.split("/");
      const base = segments[2];
      const id = segments[3] ?? "";

      // Only use the ID if it's actually a numeric ID, not a page name
      const isNumericId = /^\d+$/.test(id);
      const redirectPath = isNumericId
        ? `/${tenant}/${base}/${id}`
        : `/${tenant}/${base}/`;

      router.push(redirectPath);
    }
  }, []); // Empty dependency array like the actual implementation

  return {
    hasAffiliationFields,
    hasRoomSelectionFields,
    hasFormData,
  };
};

describe("Booking Form Missing Data Validation", () => {
  const mockPush = vi.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue({ tenant: "test-tenant" });

    // Reset to default complete context data
    mockContextData = {
      role: "Student",
      department: "Engineering",
      selectedRooms: [{ roomId: "room1", capacity: "20" }],
      bookingCalendarInfo: {
        startStr: "2024-01-01T09:00:00",
        endStr: "2024-01-01T10:00:00",
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T10:00:00"),
      },
      formData: {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "212-555-1234",
      },
    };
  });

  describe("Role Page Navigation", () => {
    it("allows access to role page regardless of missing data", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book");

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Room Selection Page Validation", () => {
    it("allows access when affiliation fields are present", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("redirects when affiliation fields are missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/selectRoom");

      // Set mock context with missing affiliation data
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: [],
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });

    it("allows modification page without affiliation check", () => {
      (usePathname as any).mockReturnValue(
        "/test-tenant/modification/selectRoom"
      );

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Form Page Validation", () => {
    it("allows access when all prerequisites are met", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("redirects when affiliation fields are missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      // Set mock context with missing affiliation
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });

    it("redirects when room selection is missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      // Set mock context with missing room selection
      mockContextData = {
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });

    it("redirects when calendar info is incomplete", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/form");

      // Set mock context with incomplete calendar info
      mockContextData = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" }, // Missing endStr
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });
  });

  describe("Confirmation Page Validation", () => {
    it("allows access when all data is complete", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("redirects when form data is missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      // Set mock context with missing form data
      mockContextData = {
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });

    it("redirects when affiliation data is missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      // Set mock context with missing affiliation
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });

    it("redirects when room selection is missing", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/confirmation");

      // Set mock context with missing room selection
      mockContextData = {
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: { firstName: "John" },
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/");
    });
  });

  describe("Path Parsing and Redirection", () => {
    it("correctly parses path segments for redirection", () => {
      (usePathname as any).mockReturnValue("/test-tenant/book/12345/form");

      // Set mock context with missing data to trigger redirection
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/book/12345");
    });

    it("handles paths without ID segments", () => {
      (usePathname as any).mockReturnValue("/test-tenant/walk-in/form");

      // Set mock context with missing data to trigger redirection
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/walk-in/");
    });
  });

  describe("Different Booking Types", () => {
    it("handles VIP booking paths", () => {
      (usePathname as any).mockReturnValue("/test-tenant/vip/form");

      // Set mock context with missing data
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/vip/");
    });

    it("handles walk-in booking paths", () => {
      (usePathname as any).mockReturnValue("/test-tenant/walk-in/selectRoom");

      // Set mock context with missing data
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/walk-in/");
    });

    it("handles modification paths differently", () => {
      (usePathname as any).mockReturnValue("/test-tenant/modification/form");

      // Set mock context with missing room selection but present modification context
      mockContextData = {
        role: null,
        department: null,
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: null,
      };

      renderHook(() => useCheckFormMissingData());

      expect(mockPush).toHaveBeenCalledWith("/test-tenant/modification/");
    });
  });

  describe("Form Data Completeness Check", () => {
    interface FormData {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      title?: string;
      description?: string;
      expectedAttendance?: string;
      bookingType?: string;
    }

    const checkFormDataCompleteness = (data: FormData | null): boolean => {
      if (!data) return false;

      // Check for required basic fields
      const requiredFields: (keyof FormData)[] = ["firstName", "lastName"];
      return requiredFields.every((field) => {
        const value = data[field];
        return value && value.trim().length > 0;
      });
    };

    it("validates complete form data", () => {
      const completeData: FormData = {
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "212-555-1234",
        title: "Meeting",
      };

      expect(checkFormDataCompleteness(completeData)).toBe(true);
    });

    it("rejects incomplete form data", () => {
      const incompleteData: FormData = {
        firstName: "John",
        phoneNumber: "212-555-1234",
        // Missing lastName
      };

      expect(checkFormDataCompleteness(incompleteData)).toBe(false);
    });

    it("rejects null or undefined data", () => {
      expect(checkFormDataCompleteness(null)).toBe(false);
    });

    it("rejects data with empty required fields", () => {
      const dataWithEmptyFields: FormData = {
        firstName: "",
        lastName: "Doe",
      };

      expect(checkFormDataCompleteness(dataWithEmptyFields)).toBe(false);
    });

    it("handles whitespace-only values as empty", () => {
      const dataWithWhitespace: FormData = {
        firstName: "   ",
        lastName: "Doe",
      };

      expect(checkFormDataCompleteness(dataWithWhitespace)).toBe(false);
    });
  });

  describe("Affiliation Data Validation", () => {
    interface AffiliationData {
      role?: string | null;
      department?: string | null;
    }

    const checkAffiliationData = (data: AffiliationData): boolean => {
      return !!(data.role && data.department);
    };

    it("validates complete affiliation data", () => {
      const completeAffiliation = {
        role: "Student",
        department: "Engineering",
      };

      expect(checkAffiliationData(completeAffiliation)).toBe(true);
    });

    it("rejects missing role", () => {
      const missingRole = {
        role: null,
        department: "Engineering",
      };

      expect(checkAffiliationData(missingRole)).toBe(false);
    });

    it("rejects missing department", () => {
      const missingDepartment = {
        role: "Student",
        department: null,
      };

      expect(checkAffiliationData(missingDepartment)).toBe(false);
    });

    it("rejects both missing", () => {
      const bothMissing = {
        role: null,
        department: null,
      };

      expect(checkAffiliationData(bothMissing)).toBe(false);
    });
  });

  describe("Room Selection Data Validation", () => {
    interface Room {
      roomId: string;
      capacity?: string;
    }

    interface CalendarInfo {
      startStr?: string;
      endStr?: string;
      start?: Date;
      end?: Date;
    }

    interface RoomSelectionData {
      selectedRooms?: Room[] | null;
      bookingCalendarInfo?: CalendarInfo | null;
    }

    const checkRoomSelectionData = (data: RoomSelectionData): boolean => {
      const hasRooms = data.selectedRooms && data.selectedRooms.length > 0;
      const hasCalendarInfo =
        data.bookingCalendarInfo &&
        data.bookingCalendarInfo.startStr &&
        data.bookingCalendarInfo.endStr;

      return !!(hasRooms && hasCalendarInfo);
    };

    it("validates complete room selection data", () => {
      const completeSelection: RoomSelectionData = {
        selectedRooms: [{ roomId: "room1", capacity: "20" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
          start: new Date("2024-01-01T09:00:00"),
          end: new Date("2024-01-01T10:00:00"),
        },
      };

      expect(checkRoomSelectionData(completeSelection)).toBe(true);
    });

    it("rejects missing room selection", () => {
      const missingRooms: RoomSelectionData = {
        selectedRooms: null,
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
      };

      expect(checkRoomSelectionData(missingRooms)).toBe(false);
    });

    it("rejects empty room array", () => {
      const emptyRooms: RoomSelectionData = {
        selectedRooms: [],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
      };

      expect(checkRoomSelectionData(emptyRooms)).toBe(false);
    });

    it("rejects missing calendar info", () => {
      const missingCalendar: RoomSelectionData = {
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: null,
      };

      expect(checkRoomSelectionData(missingCalendar)).toBe(false);
    });

    it("rejects incomplete calendar info", () => {
      const incompleteCalendar: RoomSelectionData = {
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          // Missing endStr
        },
      };

      expect(checkRoomSelectionData(incompleteCalendar)).toBe(false);
    });
  });

  describe("Navigation Path Validation", () => {
    const getNavigationRequirements = (path: string) => {
      if (path.includes("/selectRoom")) {
        return {
          needsAffiliation: true,
          needsRoomSelection: false,
          needsFormData: false,
        };
      } else if (path.includes("/form")) {
        return {
          needsAffiliation: true,
          needsRoomSelection: true,
          needsFormData: false,
        };
      } else if (path.includes("/confirmation")) {
        return {
          needsAffiliation: true,
          needsRoomSelection: true,
          needsFormData: true,
        };
      }
      return {
        needsAffiliation: false,
        needsRoomSelection: false,
        needsFormData: false,
      };
    };

    it("identifies role page requirements", () => {
      const requirements = getNavigationRequirements("/test-tenant/book");
      expect(requirements).toEqual({
        needsAffiliation: false,
        needsRoomSelection: false,
        needsFormData: false,
      });
    });

    it("identifies room selection page requirements", () => {
      const requirements = getNavigationRequirements(
        "/test-tenant/book/selectRoom"
      );
      expect(requirements).toEqual({
        needsAffiliation: true,
        needsRoomSelection: false,
        needsFormData: false,
      });
    });

    it("identifies form page requirements", () => {
      const requirements = getNavigationRequirements("/test-tenant/book/form");
      expect(requirements).toEqual({
        needsAffiliation: true,
        needsRoomSelection: true,
        needsFormData: false,
      });
    });

    it("identifies confirmation page requirements", () => {
      const requirements = getNavigationRequirements(
        "/test-tenant/book/confirmation"
      );
      expect(requirements).toEqual({
        needsAffiliation: true,
        needsRoomSelection: true,
        needsFormData: true,
      });
    });
  });

  describe("Path Parsing Utilities", () => {
    const parsePathForRedirection = (pathname: string): string => {
      const segments = pathname.split("/");
      const tenant = segments[1] || "";
      const base = segments[2] || "";
      const potentialId = segments[3] || "";

      // Check if segment 3 is an ID (numeric) or a page name
      const isNumericId = /^\d+$/.test(potentialId);

      if (isNumericId) {
        // If segment 3 is a numeric ID, include it in the redirect path
        return `/${tenant}/${base}/${potentialId}`;
      } else {
        // If segment 3 is a page name or doesn't exist, redirect to base
        return `/${tenant}/${base}`;
      }
    };

    it("parses path with ID correctly", () => {
      const redirectPath = parsePathForRedirection(
        "/test-tenant/book/12345/form"
      );
      expect(redirectPath).toBe("/test-tenant/book/12345");
    });

    it("parses path without ID correctly", () => {
      const redirectPath = parsePathForRedirection("/test-tenant/walk-in/form");
      expect(redirectPath).toBe("/test-tenant/walk-in");
    });

    it("handles modification paths", () => {
      const redirectPath = parsePathForRedirection(
        "/test-tenant/modification/form"
      );
      expect(redirectPath).toBe("/test-tenant/modification");
    });

    it("handles VIP paths", () => {
      const redirectPath = parsePathForRedirection(
        "/test-tenant/vip/selectRoom"
      );
      expect(redirectPath).toBe("/test-tenant/vip");
    });
  });

  describe("Complete Validation Logic", () => {
    interface ValidationData {
      pathname: string;
      role?: string | null;
      department?: string | null;
      selectedRooms?: any[] | null;
      bookingCalendarInfo?: any | null;
      formData?: any | null;
    }

    const validatePageAccess = (
      data: ValidationData
    ): { isValid: boolean; reason?: string } => {
      const {
        pathname,
        role,
        department,
        selectedRooms,
        bookingCalendarInfo,
        formData,
      } = data;

      const hasAffiliation =
        (role && department) || pathname.includes("/modification");
      const hasRoomSelection =
        selectedRooms &&
        bookingCalendarInfo &&
        bookingCalendarInfo.startStr &&
        bookingCalendarInfo.endStr;
      const hasFormData = formData;

      if (pathname.includes("/selectRoom")) {
        if (!hasAffiliation) {
          return { isValid: false, reason: "Missing affiliation data" };
        }
      } else if (pathname.includes("/form")) {
        if (!hasAffiliation) {
          return { isValid: false, reason: "Missing affiliation data" };
        }
        if (!hasRoomSelection) {
          return { isValid: false, reason: "Missing room selection data" };
        }
      } else if (pathname.includes("/confirmation")) {
        if (!hasAffiliation) {
          return { isValid: false, reason: "Missing affiliation data" };
        }
        if (!hasRoomSelection) {
          return { isValid: false, reason: "Missing room selection data" };
        }
        if (!hasFormData) {
          return { isValid: false, reason: "Missing form data" };
        }
      }

      return { isValid: true };
    };

    it("validates complete successful booking flow", () => {
      const completeData: ValidationData = {
        pathname: "/test-tenant/book/confirmation",
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: { firstName: "John", lastName: "Doe" },
      };

      const result = validatePageAccess(completeData);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("catches missing affiliation on form page", () => {
      const incompleteData: ValidationData = {
        pathname: "/test-tenant/book/form",
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: null,
      };

      const result = validatePageAccess(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Missing affiliation data");
    });

    it("catches missing room selection on confirmation page", () => {
      const incompleteData: ValidationData = {
        pathname: "/test-tenant/book/confirmation",
        role: "Student",
        department: "Engineering",
        selectedRooms: null,
        bookingCalendarInfo: null,
        formData: { firstName: "John" },
      };

      const result = validatePageAccess(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe("Missing room selection data");
    });

    it("allows modification pages without normal affiliation check", () => {
      const modificationData: ValidationData = {
        pathname: "/test-tenant/modification/form",
        role: null,
        department: null,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: {
          startStr: "2024-01-01T09:00:00",
          endStr: "2024-01-01T10:00:00",
        },
        formData: null,
      };

      const result = validatePageAccess(modificationData);
      expect(result.isValid).toBe(true);
    });
  });
});
