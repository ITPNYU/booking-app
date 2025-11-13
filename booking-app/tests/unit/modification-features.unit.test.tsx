import {
  BookingContext,
  BookingContextType,
} from "@/components/src/client/routes/booking/bookingProvider";
import CalendarVerticalResource from "@/components/src/client/routes/booking/components/CalendarVerticalResource";
import FormInput from "@/components/src/client/routes/booking/components/FormInput";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import {
  Days,
  FormContextLevel,
  PagePermission,
  RoomSetting,
} from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --------------------
// Global mocks
// --------------------

// Mock SchemaProvider hook so FormInput doesn't depend on external schema
vi.mock("@/components/src/client/routes/components/SchemaProvider", () => {
  return {
    __esModule: true,
    useTenantSchema: () => ({
      showNNumber: false,
      showSponsor: false,
      showSetup: true,
      showEquipment: true,
      showStaffing: true,
      showCatering: true,
      showHireSecurity: true,
      showCleaning: true,
      showBookingTypes: false,
      agreements: [],
      roleMapping: {},
      resources: [],
    }),
  };
});

// Mock hooks that FormInput relies on
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({
    default: () => ({ isAutoApproval: true, errorMessage: null }),
  })
);
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCalculateOverlap",
  () => ({
    default: () => false,
  })
);
vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({
    default: () => vi.fn(),
  })
);
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckDurationLimits",
  () => ({
    default: () => ({ durationError: null }),
  })
);
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckFormMissingData",
  () => ({
    default: () => {},
  })
);

// Mock FullCalendar to capture props passed from CalendarVerticalResource
let fullCalendarProps: any = null;
vi.mock("@fullcalendar/react", () => {
  return {
    __esModule: true,
    default: (props: any) => {
      fullCalendarProps = props;
      return <div data-testid="full-calendar" />;
    },
  };
});

// Mock Booking Date Restrictions hook for CalendarVerticalResource
vi.mock(
  "@/components/src/client/routes/booking/hooks/useBookingDateRestrictions",
  () => ({
    useBookingDateRestrictions: () => ({
      getBlackoutPeriodsForDateAndRooms: () => [],
    }),
  })
);

// Mock Next.js router and params
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({
    tenant: "mc",
  }),
}));

// --------------------
// Helper utils
// --------------------

const theme = createTheme({
  palette: {
    custom: {
      border: "#e3e3e3",
      gray3: "#888888",
    } as any,
  },
} as any);

function renderWithProviders(
  ui: React.ReactElement,
  {
    pagePermission = PagePermission.BOOKING,
    bookingContextOverrides = {},
    databaseContextOverrides = {},
  }: {
    pagePermission?: PagePermission;
    bookingContextOverrides?: Partial<BookingContextType>;
    databaseContextOverrides?: any;
  } = {}
) {
  const mockDatabaseContext = {
    adminUsers: [],
    bannedUsers: [],
    blackoutPeriods: [],
    allBookings: [],
    bookingsLoading: false,
    liaisonUsers: [],
    equipmentUsers: [],
    departmentNames: [],
    operationHours: [{ day: Days.Monday, open: 9, close: 22, isClosed: false }],
    pagePermission,
    paUsers: [],
    superAdminUsers: [],
    policySettings: { finalApproverEmail: "" },
    roomSettings: [],
    safetyTrainedUsers: [],
    settings: { bookingTypes: [] },
    userEmail: "admin@nyu.edu",
    netId: "admin",
    userApiData: undefined,
    loadMoreEnabled: true,
    reloadAdminUsers: vi.fn(),
    reloadApproverUsers: vi.fn(),
    reloadBannedUsers: vi.fn(),
    reloadBlackoutPeriods: vi.fn(),
    reloadFutureBookings: vi.fn(),
    reloadDepartmentNames: vi.fn(),
    reloadOperationHours: vi.fn(),
    reloadPaUsers: vi.fn(),
    reloadBookingTypes: vi.fn(),
    reloadSafetyTrainedUsers: vi.fn(),
    reloadPolicySettings: vi.fn(),
    setUserEmail: vi.fn(),
    fetchAllBookings: vi.fn(),
    setFilters: vi.fn(),
    setLoadMoreEnabled: vi.fn(),
    setLastItem: vi.fn(),
    preBanLogs: [],
    reloadPreBanLogs: vi.fn(),
    reloadSuperAdminUsers: vi.fn(),
    ...databaseContextOverrides,
  };

  const mockBookingContext: BookingContextType = {
    bookingCalendarInfo: undefined,
    department: undefined,
    existingCalendarEvents: [],
    formData: undefined,
    hasShownMocapModal: false,
    isBanned: false,
    isSafetyTrained: true,
    needsSafetyTraining: false,
    isInBlackoutPeriod: false,
    reloadExistingCalendarEvents: vi.fn(),
    role: undefined,
    selectedRooms: [],
    setBookingCalendarInfo: vi.fn(),
    setDepartment: vi.fn(),
    setFormData: vi.fn(),
    setHasShownMocapModal: vi.fn(),
    setRole: vi.fn(),
    setSelectedRooms: vi.fn(),
    setSubmitting: vi.fn(),
    submitting: "none",
    fetchingStatus: "loaded",
    error: null,
    setError: vi.fn(),
    ...bookingContextOverrides,
  } as BookingContextType;

  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={mockDatabaseContext as any}>
        <BookingContext.Provider value={mockBookingContext}>
          {ui}
        </BookingContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
}

// --------------------
// Tests
// --------------------

describe("Modification Features", () => {
  beforeEach(() => {
    fullCalendarProps = null; // reset capture between tests
  });

  describe("FormInput (Modification)", () => {
    it("renders title and description fields in modification context", () => {
      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />, // no calendarEventId needed for render check
        {
          bookingContextOverrides: {
            selectedRooms: [],
          },
        }
      );

      // Assert labels exist
      expect(screen.getByText(/Reservation Title/i)).toBeInTheDocument();
      expect(screen.getByText(/Reservation Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Expected Attendance/i)).toBeInTheDocument();
    });

    it("initializes staffing services toggle when existing booking has staffing services", async () => {
      const mockRooms: RoomSetting[] = [
        {
          roomId: 101,
          name: "Room 101",
          capacity: "20",
          calendarId: "cal1",
          services: ["staffing"],
          staffingServices: ["Audio Technician", "Lighting Technician"],
        } as RoomSetting,
      ];

      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />,
        {
          bookingContextOverrides: {
            selectedRooms: mockRooms,
            formData: {
              staffingServices: "Audio Technician",
              staffingServicesDetails: "Need help with sound setup",
            },
          },
        }
      );

      // Wait for the component to render and initialize
      await waitFor(() => {
        expect(screen.getByText(/Staffing\?/i)).toBeInTheDocument();
      });

      // Check that the toggle shows "Yes" (indicating it's enabled)
      await waitFor(() => {
        const yesLabel = screen.getByText("Yes");
        expect(yesLabel).toBeInTheDocument();
      });
    });

    it("initializes equipment services toggle when existing booking has equipment services", async () => {
      const mockRooms: RoomSetting[] = [
        {
          roomId: 101,
          name: "Room 101",
          capacity: "20",
          calendarId: "cal1",
          services: ["equipment"],
        } as RoomSetting,
      ];

      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />,
        {
          bookingContextOverrides: {
            selectedRooms: mockRooms,
            formData: {
              equipmentServices: "CHECKOUT_EQUIPMENT",
              equipmentServicesDetails: "Need 2 microphones",
            },
          },
        }
      );

      // Wait for the component to render and initialize
      await waitFor(() => {
        expect(screen.getByText(/Equipment\?/i)).toBeInTheDocument();
      });

      // Check that the toggle shows "Yes" (indicating it's enabled)
      await waitFor(() => {
        const yesLabels = screen.getAllByText("Yes");
        expect(yesLabels.length).toBeGreaterThan(0);
      });
    });

    it("initializes both staffing and equipment toggles when booking has both services", async () => {
      const mockRooms: RoomSetting[] = [
        {
          roomId: 101,
          name: "Room 101",
          capacity: "20",
          calendarId: "cal1",
          services: ["staffing", "equipment"],
          staffingServices: ["Audio Technician"],
        } as RoomSetting,
      ];

      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />,
        {
          bookingContextOverrides: {
            selectedRooms: mockRooms,
            formData: {
              staffingServices: "Audio Technician",
              equipmentServices: "CHECKOUT_EQUIPMENT",
            },
          },
        }
      );

      // Wait for both services to render
      await waitFor(() => {
        expect(screen.getByText(/Equipment\?/i)).toBeInTheDocument();
        expect(screen.getByText(/Staffing\?/i)).toBeInTheDocument();
      });

      // Check that both toggles show "Yes"
      await waitFor(() => {
        const yesLabels = screen.getAllByText("Yes");
        expect(yesLabels.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("does not show staffing toggle when room does not support staffing services", () => {
      const mockRooms: RoomSetting[] = [
        {
          roomId: 101,
          name: "Room 101",
          capacity: "20",
          calendarId: "cal1",
          services: [], // No staffing services
        } as RoomSetting,
      ];

      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />,
        {
          bookingContextOverrides: {
            selectedRooms: mockRooms,
            formData: {
              title: "Test Event",
            },
          },
        }
      );

      // Staffing toggle should not be present
      expect(screen.queryByText(/Staffing\?/i)).not.toBeInTheDocument();
    });

    it("renders all service sections in modification form", async () => {
      const mockRooms: RoomSetting[] = [
        {
          roomId: 101,
          name: "Room 101",
          capacity: "20",
          calendarId: "cal1",
          services: ["staffing", "equipment", "catering", "security"],
          staffingServices: ["Audio Technician"],
        } as RoomSetting,
      ];

      renderWithProviders(
        <FormInput formContext={FormContextLevel.MODIFICATION} />,
        {
          bookingContextOverrides: {
            selectedRooms: mockRooms,
            formData: {
              title: "Test Event",
              catering: "yes",
              hireSecurity: "yes",
            },
          },
          databaseContextOverrides: {
            roomSettings: mockRooms,
          },
        }
      );

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByText(/Reservation Title/i)).toBeInTheDocument();
      });

      // Check that service section exists by looking for the heading
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Services/i })).toBeInTheDocument();
      });

      // Check that equipment and staffing toggles are present
      expect(screen.getByText(/Equipment\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Staffing\?/i)).toBeInTheDocument();

      // Check that catering and security toggles are present
      expect(screen.getByText(/Catering\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Security\?/i)).toBeInTheDocument();
    });
  });

  describe("CalendarVerticalResource (Admin Editable)", () => {
    const sampleRooms: RoomSetting[] = [
      { roomId: 101, name: "Room 101", capacity: "20", calendarId: "cal1" },
    ];

    const dateView = new Date("2024-01-01T09:00:00");

    it("disallows selecting slots for normal booking user in modification context", async () => {
      renderWithProviders(
        <CalendarVerticalResource
          formContext={FormContextLevel.MODIFICATION}
          rooms={sampleRooms}
          dateView={dateView}
        />,
        {
          pagePermission: PagePermission.BOOKING,
        }
      );

      await waitFor(() => {
        const calendar = screen.getByTestId("full-calendar");
        expect(calendar).toBeInTheDocument();
      });
      // Ensure that admin privileges are NOT granted
      expect(fullCalendarProps).not.toBeNull();
      if (fullCalendarProps) {
        expect(fullCalendarProps.selectable).toBe(false);
        expect(fullCalendarProps.eventStartEditable).toBe(false);
      }
    });

    it("allows selecting slots for admin in modification context", () => {
      renderWithProviders(
        <CalendarVerticalResource
          formContext={FormContextLevel.MODIFICATION}
          rooms={sampleRooms}
          dateView={dateView}
        />,
        {
          pagePermission: PagePermission.ADMIN,
        }
      );

      expect(fullCalendarProps).not.toBeNull();
      expect(fullCalendarProps.selectable).toBe(true);
      expect(fullCalendarProps.eventStartEditable).toBe(true);
    });
  });
});
