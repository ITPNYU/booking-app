import FormInput from "@/components/src/client/routes/booking/components/FormInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { BookingOrigin, FormContextLevel } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

// Mock hooks
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({
    default: vi.fn(() => ({ isAutoApproval: true })),
  })
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({
    default: vi.fn(() => vi.fn()),
  })
);

// Mock theme with custom palette
const theme = createTheme({
  palette: {
    custom: {
      border: "#e3e3e3",
      gray3: "#888888",
    } as any,
  },
});

describe("FormInput - Field Visibility by Form Context", () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockParams = {
    tenant: "media-commons",
  };

  const mockUserApiData = {
    preferred_first_name: "John",
    preferred_last_name: "Doe",
    university_id: "N12345678",
    netid: "jd123",
    affiliation_sub_type: "student",
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
  };

  const createBookingContext = (overrides = {}) => ({
    role: "Student",
    department: "Engineering",
    selectedRooms: [
      {
        roomId: "room1",
        capacity: "20",
        services: ["equipment", "staffing", "catering", "security", "cleaning"],
        staffingServices: ["audio-tech", "lighting-tech"],
      },
    ],
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
    ...overrides,
  });

  const mockTenantSchema = {
    tenant: "media-commons",
    name: "Media Commons",
    logo: "",
    nameForPolicy: "Media Commons",
    policy: "",
    roles: ["Student", "Faculty", "Staff"],
    showNNumber: true,
    showSponsor: true,
    showSetup: true,
    showEquipment: true,
    showStaffing: true,
    showCatering: true,
    showHireSecurity: true,
    showBookingTypes: true,
    agreements: [
      {
        id: "agreement1",
        html: "<p>I agree to the terms and conditions</p>",
      },
    ],
    resources: [],
    supportVIP: true,
    supportWalkIn: true,
    resourceName: "Room",
    programMapping: {},
    roleMapping: {},
    emailMessages: {
      requestConfirmation: "",
      firstApprovalRequest: "",
      secondApprovalRequest: "",
      walkInConfirmation: "",
      vipConfirmation: "",
      checkoutConfirmation: "",
      checkinConfirmation: "",
      declined: "",
      canceled: "",
      lateCancel: "",
      noShow: "",
      closed: "",
      approvalNotice: "",
    },
  };

  const renderFormInput = (
    formContext: FormContextLevel,
    bookingContextOverrides = {},
    userApiData = mockUserApiData
  ) => {
    const bookingContext = createBookingContext(bookingContextOverrides);

    return render(
      <ThemeProvider theme={theme}>
        <DatabaseContext.Provider value={mockDatabaseContext}>
          <SchemaProvider value={mockTenantSchema}>
            <BookingContext.Provider value={bookingContext}>
              <FormInput
                formContext={formContext}
                userApiData={userApiData}
              />
            </BookingContext.Provider>
          </SchemaProvider>
        </DatabaseContext.Provider>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue(mockParams);
  });

  describe("Normal Booking (FULL_FORM)", () => {
    it("displays all expected sections", () => {
      renderFormInput(FormContextLevel.FULL_FORM);

      // Contact Information section
      expect(screen.getByText("Contact Information")).toBeInTheDocument();
      expect(screen.getByText("First Name*")).toBeInTheDocument();
      expect(screen.getByText("Last Name*")).toBeInTheDocument();
      expect(screen.getByText("Secondary Point of Contact")).toBeInTheDocument();
      expect(screen.getByText("NYU N-Number*")).toBeInTheDocument();
      expect(screen.getByText("NYU Net ID*")).toBeInTheDocument();
      expect(screen.getByText("Phone Number*")).toBeInTheDocument();

      // Sponsor section (for students)
      expect(screen.getByText("Sponsor")).toBeInTheDocument();
      expect(screen.getByText("Sponsor First Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Last Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Email*")).toBeInTheDocument();

      // Reservation Details section
      expect(screen.getByText("Reservation Details")).toBeInTheDocument();
      expect(screen.getByText("Reservation Title*")).toBeInTheDocument();
      expect(screen.getByText("Reservation Description*")).toBeInTheDocument();
      expect(screen.getByText("Booking Type*")).toBeInTheDocument();
      expect(screen.getByText("Expected Attendance*")).toBeInTheDocument();
      expect(screen.getByText("Attendee Affiliation(s)*")).toBeInTheDocument();

      // Services section
      expect(screen.getByText("Services")).toBeInTheDocument();
      expect(screen.getByText("Setup?")).toBeInTheDocument();
      expect(screen.getByText("Catering?")).toBeInTheDocument();
      expect(screen.getByText("Cleaning?")).toBeInTheDocument();
      expect(screen.getByText("Security?")).toBeInTheDocument();

      // Agreement section
      expect(screen.getByText("Agreement")).toBeInTheDocument();
      expect(screen.getByText("I agree")).toBeInTheDocument();
    });

    it("does not show sponsor section for non-student roles", () => {
      renderFormInput(FormContextLevel.FULL_FORM, { role: "Faculty" });

      // Contact Information should be present
      expect(screen.getByText("Contact Information")).toBeInTheDocument();

      // Sponsor section should NOT be present
      expect(screen.queryByText("Sponsor")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor First Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor Last Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor Email*")).not.toBeInTheDocument();

      // Reservation Details should be present
      expect(screen.getByText("Reservation Details")).toBeInTheDocument();
    });

    it("displays equipment services when room has equipment service", () => {
      renderFormInput(FormContextLevel.FULL_FORM);

      // Equipment services toggle should be visible
      expect(screen.getByText("Equipment?")).toBeInTheDocument();
    });

    it("displays staffing services when room has staffing service", () => {
      renderFormInput(FormContextLevel.FULL_FORM);

      // Staffing services toggle should be visible
      expect(screen.getByText("Staffing?")).toBeInTheDocument();
    });

    it("hides services when room does not have those services", () => {
      renderFormInput(FormContextLevel.FULL_FORM, {
        selectedRooms: [
          {
            roomId: "room1",
            capacity: "20",
            services: [], // No services
          },
        ],
      });

      // Services section title should still exist
      expect(screen.getByText("Services")).toBeInTheDocument();

      // But service-specific fields should not be visible
      expect(screen.queryByText("Equipment?")).not.toBeInTheDocument();
      expect(screen.queryByText("Staffing?")).not.toBeInTheDocument();
      expect(screen.queryByText("Catering?")).not.toBeInTheDocument();
      expect(screen.queryByText("Cleaning?")).not.toBeInTheDocument();
      expect(screen.queryByText("Security?")).not.toBeInTheDocument();
    });
  });

  describe("VIP Booking", () => {
    it("displays VIP prefix in section titles", () => {
      renderFormInput(FormContextLevel.VIP);

      expect(screen.getByText("VIP Contact Information")).toBeInTheDocument();
      expect(screen.getByText("VIP Reservation Details")).toBeInTheDocument();
      expect(screen.getByText("VIP Services")).toBeInTheDocument();
    });

    it("displays VIP prefix in field labels", () => {
      renderFormInput(FormContextLevel.VIP);

      expect(screen.getByText("VIP NYU Net ID*")).toBeInTheDocument();
      expect(screen.getByText("VIP Phone Number*")).toBeInTheDocument();
    });

    it("does NOT display N-Number field for VIP bookings", () => {
      renderFormInput(FormContextLevel.VIP);

      // N-Number should not be present
      expect(screen.queryByText("VIP NYU N-Number*")).not.toBeInTheDocument();
      expect(screen.queryByText("NYU N-Number*")).not.toBeInTheDocument();

      // But Net ID should be present
      expect(screen.getByText("VIP NYU Net ID*")).toBeInTheDocument();
    });

    it("displays contact information section", () => {
      renderFormInput(FormContextLevel.VIP);

      expect(screen.getByText("VIP Contact Information")).toBeInTheDocument();
      expect(screen.getByText("First Name*")).toBeInTheDocument();
      expect(screen.getByText("Last Name*")).toBeInTheDocument();
      expect(screen.getByText("VIP Phone Number*")).toBeInTheDocument();
    });

    it("displays sponsor section for student VIP bookings", () => {
      renderFormInput(FormContextLevel.VIP, { role: "Student" });

      expect(screen.getByText("VIP Sponsor")).toBeInTheDocument();
      expect(screen.getByText("Sponsor First Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Last Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Email*")).toBeInTheDocument();
    });

    it("displays services section with all options", () => {
      renderFormInput(FormContextLevel.VIP);

      expect(screen.getByText("VIP Services")).toBeInTheDocument();
      expect(screen.getByText("Setup?")).toBeInTheDocument();
      expect(screen.getByText("Catering?")).toBeInTheDocument();
      expect(screen.getByText("Cleaning?")).toBeInTheDocument();
      expect(screen.getByText("Security?")).toBeInTheDocument();
    });

    it("does NOT display Agreement section for VIP bookings", () => {
      renderFormInput(FormContextLevel.VIP);

      // VIP bookings don't require agreement section
      expect(screen.queryByText("Agreement")).not.toBeInTheDocument();
      expect(screen.queryByText("I agree")).not.toBeInTheDocument();
    });
  });

  describe("Walk-In Booking", () => {
    it("displays Walk-In prefix in section titles", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Contact Information")).toBeInTheDocument();
      expect(screen.getByText("Walk-In Reservation Details")).toBeInTheDocument();
      expect(screen.getByText("Walk-In Services")).toBeInTheDocument();
    });

    it("displays Walk-In prefix in field labels", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In NYU N-Number*")).toBeInTheDocument();
      expect(screen.getByText("Walk-In NYU Net ID*")).toBeInTheDocument();
      expect(screen.getByText("Walk-In Phone Number*")).toBeInTheDocument();
    });

    it("displays contact information section", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Contact Information")).toBeInTheDocument();
      expect(screen.getByText("First Name*")).toBeInTheDocument();
      expect(screen.getByText("Last Name*")).toBeInTheDocument();
      expect(screen.getByText("Walk-In Phone Number*")).toBeInTheDocument();
    });

    it("does NOT display Setup service for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Services")).toBeInTheDocument();
      // Setup should not be visible for walk-ins
      expect(screen.queryByText("Setup?")).not.toBeInTheDocument();
    });

    it("does NOT display Catering service for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Services")).toBeInTheDocument();
      // Catering should not be visible for walk-ins
      expect(screen.queryByText("Catering?")).not.toBeInTheDocument();
    });

    it("does NOT display Cleaning service for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Services")).toBeInTheDocument();
      // Cleaning should not be visible for walk-ins
      expect(screen.queryByText("Cleaning?")).not.toBeInTheDocument();
    });

    it("does NOT display Security service for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      expect(screen.getByText("Walk-In Services")).toBeInTheDocument();
      // Security should not be visible for walk-ins
      expect(screen.queryByText("Security?")).not.toBeInTheDocument();
    });

    it("displays equipment and staffing services for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      // Equipment and staffing services should be available
      expect(screen.getByText("Equipment?")).toBeInTheDocument();
      expect(screen.getByText("Staffing?")).toBeInTheDocument();
    });

    it("does NOT display Agreement section for walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN);

      // Agreement section should not be present for walk-ins
      expect(screen.queryByText("Agreement")).not.toBeInTheDocument();
      expect(screen.queryByText("I agree")).not.toBeInTheDocument();
    });

    it("displays sponsor section for student walk-in bookings", () => {
      renderFormInput(FormContextLevel.WALK_IN, { role: "Student" });

      expect(screen.getByText("Walk-In Sponsor")).toBeInTheDocument();
      expect(screen.getByText("Sponsor First Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Last Name*")).toBeInTheDocument();
      expect(screen.getByText("Sponsor Email*")).toBeInTheDocument();
    });
  });

  describe("Modification", () => {
    it("does NOT display Contact Information section", () => {
      renderFormInput(FormContextLevel.MODIFICATION);

      expect(screen.queryByText("Contact Information")).not.toBeInTheDocument();
      expect(screen.queryByText("First Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Last Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Phone Number*")).not.toBeInTheDocument();
    });

    it("does NOT display Sponsor section", () => {
      renderFormInput(FormContextLevel.MODIFICATION, { role: "Student" });

      expect(screen.queryByText("Sponsor")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor First Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor Last Name*")).not.toBeInTheDocument();
      expect(screen.queryByText("Sponsor Email*")).not.toBeInTheDocument();
    });

    it("displays Reservation Details section (simplified)", () => {
      renderFormInput(FormContextLevel.MODIFICATION);

      expect(screen.getByText("Reservation Details")).toBeInTheDocument();
      expect(screen.getByText("Reservation Title*")).toBeInTheDocument();
      expect(screen.getByText("Reservation Description*")).toBeInTheDocument();
      expect(screen.getByText("Expected Attendance*")).toBeInTheDocument();

      // Booking Type and Attendee Affiliation should NOT be in modification
      expect(screen.queryByText("Booking Type*")).not.toBeInTheDocument();
      expect(screen.queryByText("Attendee Affiliation(s)*")).not.toBeInTheDocument();
    });

    it("displays Services section", () => {
      renderFormInput(FormContextLevel.MODIFICATION);

      expect(screen.getByText("Services")).toBeInTheDocument();
      expect(screen.getByText("Setup?")).toBeInTheDocument();
      expect(screen.getByText("Catering?")).toBeInTheDocument();
      expect(screen.getByText("Cleaning?")).toBeInTheDocument();
      expect(screen.getByText("Security?")).toBeInTheDocument();
    });

    it("displays equipment and staffing services", () => {
      renderFormInput(FormContextLevel.MODIFICATION);

      expect(screen.getByText("Equipment?")).toBeInTheDocument();
      expect(screen.getByText("Staffing?")).toBeInTheDocument();
    });

    it("does NOT display Agreement section", () => {
      renderFormInput(FormContextLevel.MODIFICATION);

      expect(screen.queryByText("Agreement")).not.toBeInTheDocument();
      expect(screen.queryByText("I agree")).not.toBeInTheDocument();
    });
  });

  describe("Edit Context", () => {
    it("does NOT display N-Number field when editing a VIP booking", () => {
      renderFormInput(FormContextLevel.EDIT, {
        formData: {
          origin: BookingOrigin.VIP,
        },
      });

      // N-Number should NOT be present because it's a VIP booking (even in EDIT context)
      expect(screen.queryByText("VIP NYU N-Number*")).not.toBeInTheDocument();
      expect(screen.queryByText("NYU N-Number*")).not.toBeInTheDocument();
    });

    it("displays N-Number field when editing a non-VIP booking", () => {
      renderFormInput(FormContextLevel.EDIT, {
        formData: {
          origin: BookingOrigin.USER,
        },
      });

      // N-Number SHOULD be present for standard user edits
      expect(screen.getByText("NYU N-Number*")).toBeInTheDocument();
    });
  });

  describe("Field Visibility Based on Tenant Schema", () => {
    it("hides N-Number when showNNumber is false", () => {
      const schemaWithoutNNumber = {
        ...mockTenantSchema,
        showNNumber: false,
      };

      render(
        <ThemeProvider theme={theme}>
          <DatabaseContext.Provider value={mockDatabaseContext}>
            <SchemaProvider value={schemaWithoutNNumber}>
              <BookingContext.Provider value={createBookingContext()}>
                <FormInput
                  formContext={FormContextLevel.FULL_FORM}
                  userApiData={mockUserApiData}
                />
              </BookingContext.Provider>
            </SchemaProvider>
          </DatabaseContext.Provider>
        </ThemeProvider>
      );

      expect(screen.queryByText("NYU N-Number*")).not.toBeInTheDocument();
    });

    it("hides Net ID when showSponsor is false", () => {
      const schemaWithoutSponsor = {
        ...mockTenantSchema,
        showSponsor: false,
      };

      render(
        <ThemeProvider theme={theme}>
          <DatabaseContext.Provider value={mockDatabaseContext}>
            <SchemaProvider value={schemaWithoutSponsor}>
              <BookingContext.Provider value={createBookingContext()}>
                <FormInput
                  formContext={FormContextLevel.FULL_FORM}
                  userApiData={mockUserApiData}
                />
              </BookingContext.Provider>
            </SchemaProvider>
          </DatabaseContext.Provider>
        </ThemeProvider>
      );

      expect(screen.queryByText("NYU Net ID*")).not.toBeInTheDocument();
    });

    it("hides Setup service when showSetup is false", () => {
      const schemaWithoutSetup = {
        ...mockTenantSchema,
        showSetup: false,
      };

      render(
        <ThemeProvider theme={theme}>
          <DatabaseContext.Provider value={mockDatabaseContext}>
            <SchemaProvider value={schemaWithoutSetup}>
              <BookingContext.Provider value={createBookingContext()}>
                <FormInput
                  formContext={FormContextLevel.FULL_FORM}
                  userApiData={mockUserApiData}
                />
              </BookingContext.Provider>
            </SchemaProvider>
          </DatabaseContext.Provider>
        </ThemeProvider>
      );

      expect(screen.queryByText("Setup?")).not.toBeInTheDocument();
    });

    it("hides Booking Type when showBookingTypes is false", () => {
      const schemaWithoutBookingTypes = {
        ...mockTenantSchema,
        showBookingTypes: false,
      };

      render(
        <ThemeProvider theme={theme}>
          <DatabaseContext.Provider value={mockDatabaseContext}>
            <SchemaProvider value={schemaWithoutBookingTypes}>
              <BookingContext.Provider value={createBookingContext()}>
                <FormInput
                  formContext={FormContextLevel.FULL_FORM}
                  userApiData={mockUserApiData}
                />
              </BookingContext.Provider>
            </SchemaProvider>
          </DatabaseContext.Provider>
        </ThemeProvider>
      );

      expect(screen.queryByText("Booking Type*")).not.toBeInTheDocument();
    });
  });

  describe("Field Visibility Summary", () => {
    it("comparison: Normal vs VIP vs Walk-In vs Modification", () => {
      const testCases = [
        {
          context: FormContextLevel.FULL_FORM,
          name: "Normal Booking",
          shouldHave: [
            "Contact Information",
            "Sponsor",
            "Reservation Details",
            "Services",
            "Agreement",
          ],
          shouldNotHave: [],
        },
        {
          context: FormContextLevel.VIP,
          name: "VIP Booking",
          shouldHave: [
            "VIP Contact Information",
            "VIP Reservation Details",
            "VIP Services",
          ],
          shouldNotHave: ["VIP NYU N-Number*", "Agreement"],
        },
        {
          context: FormContextLevel.WALK_IN,
          name: "Walk-In Booking",
          shouldHave: [
            "Walk-In Contact Information",
            "Walk-In Reservation Details",
            "Walk-In Services",
          ],
          shouldNotHave: ["Agreement", "Setup?", "Catering?", "Cleaning?", "Security?"],
        },
        {
          context: FormContextLevel.MODIFICATION,
          name: "Modification",
          shouldHave: ["Reservation Details", "Services"],
          shouldNotHave: [
            "Contact Information",
            "Sponsor",
            "Agreement",
            "Booking Type*",
            "Attendee Affiliation(s)*",
          ],
        },
      ];

      testCases.forEach(({ context, name, shouldHave, shouldNotHave }) => {
        const { unmount } = renderFormInput(context);

        shouldHave.forEach((item) => {
          expect(screen.getByText(item)).toBeInTheDocument();
        });

        shouldNotHave.forEach((item) => {
          expect(screen.queryByText(item)).not.toBeInTheDocument();
        });

        unmount();
      });
    });
  });
});

