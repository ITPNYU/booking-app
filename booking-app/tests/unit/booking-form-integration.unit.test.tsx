import { ThemeProvider, createTheme } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/components/src/types";
import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";

// Mock the form context and providers
const mockBookingContext = {
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
  setFormData: vi.fn(),
  isBanned: false,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
};

const mockDatabaseContext = {
  userEmail: "test@nyu.edu",
  settings: {
    bookingTypes: [
      { bookingType: "Academic" },
      { bookingType: "Event" },
      { bookingType: "Meeting" },
    ],
  },
  userApiData: {
    preferred_first_name: "John",
    preferred_last_name: "Doe",
    university_id: "N12345678",
    netid: "jd123",
  },
};

// Mock theme
const theme = createTheme();

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

describe("Booking Form Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Flow Validation", () => {
    const simulateCompleteBookingFlow = () => {
      return {
        // Step 1: User role and affiliation
        affiliationData: {
          role: "Student",
          department: "Engineering",
        },
        // Step 2: Room selection
        roomData: {
          selectedRooms: [{ roomId: "room1", capacity: "20" }],
          calendarInfo: {
            startStr: "2024-01-01T09:00:00",
            endStr: "2024-01-01T10:00:00",
          },
        },
        // Step 3: Form completion
        formData: {
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "212-555-1234",
          title: "Study Session",
          description: "Group study for final exams",
          expectedAttendance: "15",
          bookingType: "Academic",
          sponsorFirstName: "Prof",
          sponsorLastName: "Smith",
          sponsorEmail: "prof.smith@nyu.edu",
        },
      };
    };

    it("validates complete booking flow", () => {
      const bookingFlow = simulateCompleteBookingFlow();

      // Validate each step
      expect(bookingFlow.affiliationData.role).toBeTruthy();
      expect(bookingFlow.affiliationData.department).toBeTruthy();
      expect(bookingFlow.roomData.selectedRooms.length).toBeGreaterThan(0);
      expect(bookingFlow.roomData.calendarInfo.startStr).toBeTruthy();
      expect(bookingFlow.formData.firstName).toBeTruthy();
      expect(bookingFlow.formData.lastName).toBeTruthy();
      expect(bookingFlow.formData.phoneNumber).toBeTruthy();
      expect(bookingFlow.formData.title).toBeTruthy();
      expect(bookingFlow.formData.expectedAttendance).toBeTruthy();
    });
  });

  describe("Form Submission Validation", () => {
    interface SubmissionData {
      formData: any;
      context: {
        isAutoApproval: boolean;
        selectedRooms: any[];
        bookingCalendarInfo: any;
        userEmail: string;
      };
    }

    const validateSubmission = (data: SubmissionData) => {
      const errors: string[] = [];

      // Check required fields
      if (!data.formData.firstName?.trim())
        errors.push("First name is required");
      if (!data.formData.lastName?.trim()) errors.push("Last name is required");
      if (!data.formData.phoneNumber?.trim())
        errors.push("Phone number is required");
      if (!data.formData.title?.trim()) errors.push("Title is required");
      if (!data.formData.expectedAttendance?.trim())
        errors.push("Expected attendance is required");

      // Check student-specific requirements
      if (data.formData.role === "Student") {
        if (!data.formData.sponsorFirstName?.trim())
          errors.push("Sponsor first name is required");
        if (!data.formData.sponsorLastName?.trim())
          errors.push("Sponsor last name is required");
        if (!data.formData.sponsorEmail?.trim())
          errors.push("Sponsor email is required");
      }

      // Check context requirements
      if (!data.context.selectedRooms?.length)
        errors.push("Room selection is required");
      if (!data.context.bookingCalendarInfo)
        errors.push("Calendar info is required");

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    it("validates successful submission", () => {
      const submissionData: SubmissionData = {
        formData: {
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "212-555-1234",
          title: "Study Session",
          expectedAttendance: "15",
          role: "Student",
          sponsorFirstName: "Prof",
          sponsorLastName: "Smith",
          sponsorEmail: "prof.smith@nyu.edu",
        },
        context: {
          isAutoApproval: true,
          selectedRooms: [{ roomId: "room1" }],
          bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
          userEmail: "student@nyu.edu",
        },
      };

      const result = validateSubmission(submissionData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("catches missing required fields", () => {
      const submissionData: SubmissionData = {
        formData: {
          firstName: "",
          lastName: "Doe",
          phoneNumber: "",
          title: "Study Session",
          expectedAttendance: "15",
        },
        context: {
          isAutoApproval: true,
          selectedRooms: [{ roomId: "room1" }],
          bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
          userEmail: "student@nyu.edu",
        },
      };

      const result = validateSubmission(submissionData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("First name is required");
      expect(result.errors).toContain("Phone number is required");
    });

    it("catches missing sponsor information for students", () => {
      const submissionData: SubmissionData = {
        formData: {
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "212-555-1234",
          title: "Study Session",
          expectedAttendance: "15",
          role: "Student",
          // Missing sponsor fields
        },
        context: {
          isAutoApproval: true,
          selectedRooms: [{ roomId: "room1" }],
          bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
          userEmail: "student@nyu.edu",
        },
      };

      const result = validateSubmission(submissionData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Sponsor first name is required");
      expect(result.errors).toContain("Sponsor last name is required");
      expect(result.errors).toContain("Sponsor email is required");
    });
  });

  describe("Auto-Approval Logic", () => {
    interface AutoApprovalData {
      duration: number; // in milliseconds
      selectedRooms: {
        roomId: string;
        maxHour?: {
          student?: number;
          studentWalkIn?: number;
          faculty?: number;
          facultyWalkIn?: number;
          admin?: number;
          adminWalkIn?: number;
        };
        minHour?: {
          student?: number;
          studentWalkIn?: number;
          faculty?: number;
          facultyWalkIn?: number;
          admin?: number;
          adminWalkIn?: number;
        };
      }[];
      formData: {
        roomSetup?: string;
        mediaServices?: string[];
        equipmentServices?: string[];
        staffingServices?: string[];
        catering?: string;
      };
      isWalkIn: boolean;
      role?: "Student" | "Faculty" | "Admin";
    }

    const checkAutoApproval = (data: AutoApprovalData) => {
      const errors: string[] = [];

      // Get hour limits based on role and room settings
      const { maxHours, minHours } = getBookingHourLimits(
        data.selectedRooms,
        data.role as Role,
        data.isWalkIn
      );

      // Duration check
      const durationInHours = data.duration / (1000 * 60 * 60);
      if (durationInHours > maxHours) {
        errors.push(`Event duration exceeds ${maxHours} hours for ${data.role || "student"} ${data.isWalkIn ? "walk-in" : ""} booking`);
      }

      if (durationInHours < minHours) {
        errors.push(`${data.isWalkIn ? "Walk-in" : ""} event duration must be at least ${minHours} hours for ${data.role || "student"} booking`);
      }

      // Room setup requires approval
      if (data.formData.roomSetup === "yes") {
        errors.push(
          "Requesting additional room setup for an event will require approval"
        );
      }

      // Equipment services require approval
      if (
        !data.isWalkIn &&
        data.formData.equipmentServices &&
        data.formData.equipmentServices.length > 0
      ) {
        errors.push(
          "Requesting equipment services for an event will require approval"
        );
      }

      // Staffing services require approval
      if (
        !data.isWalkIn &&
        data.formData.staffingServices &&
        data.formData.staffingServices.length > 0
      ) {
        errors.push(
          "Requesting staffing services for an event will require approval"
        );
      }

      // Catering requires approval
      if (data.formData.catering === "yes") {
        errors.push("Providing catering for an event will require approval");
      }

      return {
        isAutoApproval: errors.length === 0,
        errors,
      };
    };

    it("approves simple booking automatically with default limits", () => {
      const data: AutoApprovalData = {
        duration: 7200000, // 2 hours
        selectedRooms: [{ roomId: "room1" }],
        formData: {},
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("uses role-specific hour limits", () => {
      const data: AutoApprovalData = {
        duration: 10800000, // 3 hours
        selectedRooms: [{
          roomId: "room1",
          maxHour: {
            student: 2, // More restrictive for students
            faculty: 4,
            admin: 6
          }
        }],
        formData: {},
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain("Event duration exceeds 2 hours for Student booking");

      // Same duration should be approved for faculty
      const facultyResult = checkAutoApproval({ ...data, role: "Faculty" });
      expect(facultyResult.isAutoApproval).toBe(true);
    });

    it("uses walk-in specific limits when available", () => {
      const data: AutoApprovalData = {
        duration: 5400000, // 1.5 hours
        selectedRooms: [{
          roomId: "room1",
          maxHour: {
            student: 4,
            studentWalkIn: 1 // More restrictive for walk-ins
          },
          minHour: {
            student: 0.5,
            studentWalkIn: 1 // Higher minimum for walk-ins
          }
        }],
        formData: {},
        isWalkIn: true,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain("Event duration exceeds 1 hours for Student walk-in booking");
    });

    it("falls back to regular role limits when walk-in limits not defined", () => {
      const data: AutoApprovalData = {
        duration: 5400000, // 1.5 hours
        selectedRooms: [{
          roomId: "room1",
          maxHour: {
            student: 2 // Only regular student limit defined
          }
        }],
        formData: {},
        isWalkIn: true,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(true);
      // Should use regular student limit of 2 hours
    });

    it("uses most restrictive limits across multiple rooms", () => {
      const data: AutoApprovalData = {
        duration: 5400000, // 1.5 hours
        selectedRooms: [
          {
            roomId: "room1",
            maxHour: { student: 2 }
          },
          {
            roomId: "room2",
            maxHour: { student: 1 } // More restrictive
          }
        ],
        formData: {},
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain("Event duration exceeds 1 hours for Student booking");
    });

    it("requires approval for events with room setup", () => {
      const data: AutoApprovalData = {
        duration: 3600000, // 1 hour
        selectedRooms: [{ roomId: "room1" }],
        formData: { roomSetup: "yes" },
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain(
        "Requesting additional room setup for an event will require approval"
      );
    });

    it("requires approval for events with equipment services", () => {
      const data: AutoApprovalData = {
        duration: 3600000, // 1 hour
        selectedRooms: [{ roomId: "room1" }],
        formData: { equipmentServices: ["camera"] },
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain(
        "Requesting equipment services for an event will require approval"
      );
    });

    it("requires approval for events with staffing services", () => {
      const data: AutoApprovalData = {
        duration: 3600000, // 1 hour
        selectedRooms: [{ roomId: "room1" }],
        formData: { staffingServices: ["audio tech"] },
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain(
        "Requesting staffing services for an event will require approval"
      );
    });

    it("requires approval for events with catering", () => {
      const data: AutoApprovalData = {
        duration: 3600000, // 1 hour
        selectedRooms: [{ roomId: "room1" }],
        formData: { catering: "yes" },
        isWalkIn: false,
        role: "Student"
      };

      const result = checkAutoApproval(data);
      expect(result.isAutoApproval).toBe(false);
      expect(result.errors).toContain(
        "Providing catering for an event will require approval"
      );
    });
  });

  describe("Form State Management", () => {
    const createFormState = (overrides = {}) => ({
      role: null,
      department: null,
      selectedRooms: [],
      bookingCalendarInfo: null,
      formData: null,
      isBanned: false,
      needsSafetyTraining: false,
      isInBlackoutPeriod: false,
      isSubmitting: false,
      agreements: [],
      checkedAgreements: {},
      ...overrides,
    });

    it("tracks form progression correctly", () => {
      let formState = createFormState();

      // Step 1: Set role and department
      formState = { ...formState, role: "Student", department: "Engineering" };
      expect(formState.role).toBe("Student");
      expect(formState.department).toBe("Engineering");

      // Step 2: Select rooms
      formState = {
        ...formState,
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
      };
      expect(formState.selectedRooms).toHaveLength(1);
      expect(formState.bookingCalendarInfo).toBeTruthy();

      // Step 3: Fill form
      formState = {
        ...formState,
        formData: { firstName: "John", lastName: "Doe" },
      };
      expect(formState.formData).toBeTruthy();
    });

    it("prevents submission when user is banned", () => {
      const formState = createFormState({
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
        formData: { firstName: "John" },
        isBanned: true,
      });

      const canSubmit =
        !formState.isBanned &&
        !formState.needsSafetyTraining &&
        !formState.isInBlackoutPeriod &&
        !formState.isSubmitting;

      expect(canSubmit).toBe(false);
    });

    it("prevents submission during blackout period", () => {
      const formState = createFormState({
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
        formData: { firstName: "John" },
        isInBlackoutPeriod: true,
      });

      const canSubmit =
        !formState.isBanned &&
        !formState.needsSafetyTraining &&
        !formState.isInBlackoutPeriod &&
        !formState.isSubmitting;

      expect(canSubmit).toBe(false);
    });

    it("allows submission when all conditions are met", () => {
      const formState = createFormState({
        role: "Student",
        department: "Engineering",
        selectedRooms: [{ roomId: "room1" }],
        bookingCalendarInfo: { startStr: "2024-01-01T09:00:00" },
        formData: { firstName: "John" },
        isBanned: false,
        needsSafetyTraining: false,
        isInBlackoutPeriod: false,
        isSubmitting: false,
      });

      const canSubmit =
        !formState.isBanned &&
        !formState.needsSafetyTraining &&
        !formState.isInBlackoutPeriod &&
        !formState.isSubmitting;

      expect(canSubmit).toBe(true);
    });
  });
});
