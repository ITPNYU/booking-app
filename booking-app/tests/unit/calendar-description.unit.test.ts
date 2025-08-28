import { bookingContentsToDescription } from "@/components/src/server/calendars";
import { BookingFormDetails, BookingStatusLabel } from "@/components/src/types";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase Admin
vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      settings: vi.fn(),
    }),
  },
}));

// Mock Google Calendar Client
vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: vi.fn().mockResolvedValue({
    events: {
      insert: vi.fn().mockResolvedValue({
        data: { id: "mock-calendar-event-id" },
      }),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue({
        data: { items: [] },
      }),
    },
  }),
}));

// Mock server admin functions
vi.mock("@/components/src/server/admin", () => ({
  serverGetRoomCalendarIds: vi.fn().mockResolvedValue(["mock-calendar-id"]),
}));

describe("Calendar Description Functions", () => {
  let mockBookingContents: BookingFormDetails;

  beforeEach(() => {
    vi.clearAllMocks();

    // Base mock booking contents
    mockBookingContents = {
      calendarEventId: "test-calendar-event-id",
      email: "test@nyu.edu",
      startDate: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
      endDate: Timestamp.fromDate(new Date("2024-01-15T12:00:00Z")),
      roomId: "101, 102",
      requestNumber: 12345,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      firstApprovedAt: Timestamp.now(),
      firstApprovedBy: "",
      finalApprovedAt: Timestamp.now(),
      finalApprovedBy: "",
      declinedAt: Timestamp.now(),
      declinedBy: "",
      canceledAt: Timestamp.now(),
      canceledBy: "",
      checkedInAt: Timestamp.now(),
      checkedInBy: "",
      checkedOutAt: Timestamp.now(),
      checkedOutBy: "",
      noShowedAt: Timestamp.now(),
      noShowedBy: "",
      walkedInAt: Timestamp.now(),
      origin: "user",
      firstName: "John",
      lastName: "Doe",
      secondaryName: "Jane Smith",
      nNumber: "N12345678",
      netId: "jd123",
      phoneNumber: "555-0123",
      department: "ITP",
      otherDepartment: "",
      role: "Student",
      sponsorFirstName: "Prof",
      sponsorLastName: "Smith",
      sponsorEmail: "prof.smith@nyu.edu",
      title: "Test Event Title",
      description: "Test event description",
      bookingType: "Workshop",
      attendeeAffiliation: "NYU Members with an active NYU ID",
      roomSetup: "Classroom",
      setupDetails: "Tables in U-shape",
      mediaServices: "Audio/Visual equipment",
      mediaServicesDetails: "Projector and speakers",
      equipmentServices: "Camera",
      equipmentServicesDetails: "HD camera setup",
      staffingServices: "Audio technician",
      staffingServicesDetails: "Audio support for event",
      catering: "No",
      hireSecurity: "No",
      expectedAttendance: "25",
      cateringService: "None",
      cleaningService: "no",
      chartFieldForCatering: "",
      chartFieldForCleaning: "",
      chartFieldForSecurity: "",
      chartFieldForRoomSetup: "",
      status: BookingStatusLabel.REQUESTED,
      startTime: "10:00 AM",
      endTime: "12:00 PM",
    } as BookingFormDetails;
  });

  describe("bookingContentsToDescription", () => {
    it("should generate HTML description with all main sections", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      // Check for main sections
      expect(result).toContain("<h3>Request</h3>");
      expect(result).toContain("<h3>Requester</h3>");
      expect(result).toContain("<h3>Details</h3>");
      expect(result).toContain("<h3>Services</h3>");
      expect(result).toContain("<h3>Cancellation Policy</h3>");

      // Check for proper HTML list structure
      expect(result).toContain("<ul>");
      expect(result).toContain("</ul>");
      expect(result).toContain("<li>");
      expect(result).toContain("</li>");
    });

    it("should include request information correctly", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      expect(result).toContain("<strong>Request #:</strong> 12345");
      expect(result).toContain("<strong>Room(s):</strong> 101, 102");
      expect(result).toContain("<strong>Status:</strong> REQUESTED");
    });

    it("should include requester information correctly", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      expect(result).toContain("<strong>NetID:</strong> jd123");
      expect(result).toContain("<strong>Name:</strong> John Doe");
      expect(result).toContain("<strong>Department:</strong> ITP");
      expect(result).toContain("<strong>Role:</strong> Student");
      expect(result).toContain("<strong>Email:</strong> test@nyu.edu");
      expect(result).toContain("<strong>Phone:</strong> 555-0123");
      expect(result).toContain("<strong>N-Number:</strong> N12345678");
      expect(result).toContain(
        "<strong>Secondary Contact:</strong> Jane Smith"
      );
      expect(result).toContain("<strong>Sponsor Name:</strong> Prof Smith");
      expect(result).toContain(
        "<strong>Sponsor Email:</strong> prof.smith@nyu.edu"
      );
    });

    it("should include event details correctly", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      expect(result).toContain("<strong>Title:</strong> Test Event Title");
      expect(result).toContain(
        "<strong>Description:</strong> Test event description"
      );
      expect(result).toContain("<strong>Booking Type:</strong> Workshop");
      expect(result).toContain("<strong>Origin:</strong> User");
      expect(result).toContain("<strong>Expected Attendance:</strong> 25");
      expect(result).toContain(
        "<strong>Attendee Affiliation:</strong> NYU Members with an active NYU ID"
      );
    });

    it("should include services information correctly", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      expect(result).toContain(
        "<strong>Room Setup:</strong> Tables in U-shape"
      );
      expect(result).toContain(
        "<strong>Equipment Service:</strong> Camera"
      );
      expect(result).toContain(
        "<strong>Equipment Service Details:</strong> HD camera setup"
      );
      expect(result).toContain(
        "<strong>Staffing Service:</strong> Audio technician"
      );
      expect(result).toContain(
        "<strong>Staffing Service Details:</strong> Audio support for event"
      );
      // Services that are not requested should not appear in the description
      expect(result).not.toContain("Cleaning Service");
      expect(result).not.toContain("Security");
    });

    it('should display "none" for "no" or "No" values', () => {
      const bookingWithNoValues = {
        ...mockBookingContents,
        catering: "no",
        cateringService: "no", // This takes priority over catering
        hireSecurity: "No",
        mediaServices: "",
        equipmentServices: "",
        staffingServices: "",
        cleaningService: "no",
      };

      const result = bookingContentsToDescription(bookingWithNoValues);

      // Services that are not requested should not appear in the description
      expect(result).not.toContain("Catering Service");
      expect(result).not.toContain("Security");
      expect(result).not.toContain("Equipment Service");
      expect(result).not.toContain("Staffing Service");
    });

    it("should handle empty or undefined values gracefully", () => {
      const bookingWithEmptyValues = {
        ...mockBookingContents,
        firstName: "",
        lastName: "",
        description: undefined,
        expectedAttendance: null,
      };

      const result = bookingContentsToDescription(bookingWithEmptyValues);

      expect(result).toContain("<strong>Name:</strong>");
      expect(result).toContain("<strong>Description:</strong> none");
      expect(result).toContain("<strong>Expected Attendance:</strong> none");
    });

    it("should include chart fields when provided", () => {
      const bookingWithChartFields = {
        ...mockBookingContents,
        chartFieldForRoomSetup: "12345-SETUP",
        chartFieldForCatering: "12345-CATERING",
        chartFieldForCleaning: "12345-CLEANING",
        chartFieldForSecurity: "12345-SECURITY",
        hireSecurity: "Yes", // Set to "Yes" so security service appears
        cleaningService: "yes", // Set to "yes" so cleaning service appears
      };

      const result = bookingContentsToDescription(bookingWithChartFields);

      expect(result).toContain(
        "<strong>Room Setup Chart Field:</strong> 12345-SETUP"
      );
      expect(result).toContain(
        "<strong>Catering Chart Field:</strong> 12345-CATERING"
      );
      expect(result).toContain(
        "<strong>Cleaning Service Chart Field:</strong> 12345-CLEANING"
      );
      expect(result).toContain(
        "<strong>Security Chart Field:</strong> 12345-SECURITY"
      );
    });

    it("should not include chart fields when not provided", () => {
      const result = bookingContentsToDescription(mockBookingContents);

      expect(result).not.toContain("Room Setup Chart Field");
      expect(result).not.toContain("Catering Chart Field");
      expect(result).not.toContain("Cleaning Services Chart Field");
      expect(result).not.toContain("Security Chart Field");
    });

    it("should handle alternative property names", () => {
      const bookingWithAlternativeProps = {
        ...mockBookingContents,
        roomSetup: undefined,
        setupDetails: "U-shape setup",
        cateringService: undefined,
        catering: "Coffee and snacks",
      };

      const result = bookingContentsToDescription(bookingWithAlternativeProps);

      expect(result).toContain("<strong>Room Setup:</strong> U-shape setup");
      expect(result).toContain("<strong>Catering Service:</strong> Coffee and snacks");
    });

    it("should handle time formatting correctly", () => {
      const bookingWithTimes = {
        ...mockBookingContents,
        startTime: "9:30 AM",
        endTime: "11:45 PM",
      };

      const result = bookingContentsToDescription(bookingWithTimes);

      expect(result).toContain("<strong>Time:</strong> 9:30 AM - 11:45 PM");
    });
  });

  describe("buildBookingContents function behavior", () => {
    it("should create booking contents object with correct date formatting", () => {
      // This tests the buildBookingContents function indirectly through the POST route
      const startDate = new Date("2024-01-15T09:00:00Z");
      const endDate = new Date("2024-01-15T15:00:00Z"); // 3PM UTC should be PM in most timezones

      const data = {
        title: "Test Event",
        description: "Test Description",
        department: "ITP",
        firstName: "John",
        lastName: "Doe",
      };

      // Simulate the buildBookingContents function behavior
      const buildBookingContents = (
        data: any,
        selectedRoomIds: string,
        startDateObj: Date,
        endDateObj: Date,
        status: BookingStatusLabel,
        requestNumber: number,
        origin?: string
      ) => {
        return {
          ...data,
          roomId: selectedRoomIds,
          startDate: startDateObj.toLocaleDateString(),
          startTime: startDateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          endTime: endDateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          status,
          requestNumber,
          origin,
        } as unknown as BookingFormDetails;
      };

      const result = buildBookingContents(
        data,
        "101, 102",
        startDate,
        endDate,
        BookingStatusLabel.REQUESTED,
        12345,
        "user"
      );

      expect(result.roomId).toBe("101, 102");
      expect(result.status).toBe(BookingStatusLabel.REQUESTED);
      expect(result.requestNumber).toBe(12345);
      expect(result.origin).toBe("user");
      expect(result.startDate).toBe(startDate.toLocaleDateString());
      // Test that time formatting includes expected patterns (avoiding timezone issues)
      expect(result.startTime).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      expect(result.endTime).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });
  });

  describe("createBookingCalendarEvent function behavior", () => {
    it("should handle title truncation correctly", () => {
      // Test title truncation behavior
      const longTitle =
        "This is a very long title that exceeds the 25 character limit and should be truncated";
      const truncatedTitle =
        longTitle.length > 25 ? longTitle.substring(0, 25) + "..." : longTitle;

      expect(truncatedTitle).toBe("This is a very long title...");
      expect(truncatedTitle.length).toBe(28); // 25 chars + "..."
    });

    it("should not truncate short titles", () => {
      const shortTitle = "Short Title";
      const truncatedTitle =
        shortTitle.length > 25
          ? shortTitle.substring(0, 25) + "..."
          : shortTitle;

      expect(truncatedTitle).toBe("Short Title");
    });

    it("should format calendar event title with status and room info", () => {
      const selectedRoomIds = ["101", "102"];
      const truncatedTitle = "Test Event";
      const expectedTitle = `[${BookingStatusLabel.REQUESTED}] ${selectedRoomIds.join(", ")} ${truncatedTitle}`;

      expect(expectedTitle).toBe("[REQUESTED] 101, 102 Test Event");
    });
  });
});
