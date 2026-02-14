import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import UserRolePage from "../../components/src/client/routes/booking/formPages/UserRolePage";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { AuthContext } from "../../components/src/client/routes/components/AuthProvider";
import { TenantSchemaContext } from "../../components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "../../components/src/types";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  usePathname: vi.fn(() => "/test-tenant/book/role"),
}));

const mockTenantSchema = {
  roles: ["Student", "Faculty", "Staff"],
  programMapping: {
    Engineering: ["CS", "EE"],
    Arts: ["DRAMA", "MUSIC"],
    Business: ["MBA"],
    Other: [],
  },
  roleMapping: {
    Student: ["DEGREE", "STUDENT"],
    Faculty: ["FACULTY"],
    Staff: ["STAFF"],
  },
  schoolMapping: {
    "Tandon School of Engineering": ["Engineering"],
    "Tisch School of the Arts": ["Arts"],
    "Stern School of Business": ["Business"],
  },
};

const createWrapper = (
  bookingContextValue: any,
  databaseContextValue: any = {},
  authContextValue: any = {},
  tenantSchemaValue: any = mockTenantSchema
) => {
  const defaultDatabaseContext = {
    liaisonUsers: [],
    userEmail: "test@nyu.edu",
    reloadFutureBookings: vi.fn(),
    pagePermission: "booking",
    roomSettings: [],
    userApiData: null,
    ...databaseContextValue,
  };

  const defaultAuthContext = {
    user: { email: "test@nyu.edu" },
    ...authContextValue,
  };

  return ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={defaultAuthContext}>
      <DatabaseContext.Provider value={defaultDatabaseContext}>
        <TenantSchemaContext.Provider value={tenantSchemaValue}>
          <BookingContext.Provider value={bookingContextValue}>
            {children}
          </BookingContext.Provider>
        </TenantSchemaContext.Provider>
      </DatabaseContext.Provider>
    </AuthContext.Provider>
  );
};

describe("UserRolePage - Next Button Disabled State Regression Tests", () => {
  const mockPush = vi.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue({ tenant: "test-tenant" });
  });

  describe("REGRESSION: Auto-filled role/department without school selection", () => {
    it("keeps Next button disabled when role and department are auto-filled but school is not selected", async () => {
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: "Student", // Auto-filled from Identity API
        department: "Engineering", // Auto-filled from Identity API
        setRole,
        setDepartment,
        setFormData,
        formData: {}, // School is NOT set
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      const databaseContextValue = {
        userApiData: {
          affiliation_sub_type: "DEGREE",
          reporting_dept_code: "CS",
        },
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue, databaseContextValue) as any,
      });

      // Wait for auto-mapping to complete
      await waitFor(() => {
        expect(setRole).toHaveBeenCalled();
        expect(setDepartment).toHaveBeenCalled();
      });

      // Find the Next button
      const nextButton = screen.getByRole("button", { name: /next/i });

      // CRITICAL: Next button should be DISABLED because school is not selected
      expect(nextButton).toBeDisabled();
    });

    it("enables Next button only after school is selected, even with auto-filled role/department", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: "Student", // Auto-filled
        department: "Engineering", // Auto-filled
        setRole,
        setDepartment,
        setFormData,
        formData: {},
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      // Initially disabled
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Select a school
      const schoolDropdown = screen.getByTestId("school-select");
      await user.click(schoolDropdown);
      
      // Wait for options to appear and select one
      const schoolOption = await screen.findByText("Tandon School of Engineering");
      await user.click(schoolOption);

      // After selecting school, with auto-filled role and department, button should be enabled
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });

    it("Next button remains disabled if school is selected but department is cleared", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: "Student",
        department: null, // No department
        setRole,
        setDepartment,
        setFormData,
        formData: { school: "Tandon School of Engineering" }, // School is set
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      const nextButton = screen.getByRole("button", { name: /next/i });
      
      // Should be disabled: school is set but department is not
      expect(nextButton).toBeDisabled();
    });

    it("Next button remains disabled if school and department are selected but role is not", async () => {
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: null, // No role
        department: "Engineering", // Department is set
        setRole,
        setDepartment,
        setFormData,
        formData: { school: "Tandon School of Engineering" }, // School is set
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      const nextButton = screen.getByRole("button", { name: /next/i });
      
      // Should be disabled: school and department are set but role is not
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Complete affiliation flow validation", () => {
    it("enables Next button when all required fields are selected (school, department, role)", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn((val) => {
        bookingContextValue.role = val;
      });
      const setDepartment = vi.fn((val) => {
        bookingContextValue.department = val;
      });
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: null,
        department: null,
        setRole,
        setDepartment,
        setFormData,
        formData: {},
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      const { rerender } = render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();

      // Step 1: Select school
      const schoolDropdown = screen.getByTestId("school-select");
      await user.click(schoolDropdown);
      const schoolOption = await screen.findByText("Tandon School of Engineering");
      await user.click(schoolOption);
      bookingContextValue.formData.school = "Tandon School of Engineering";

      rerender(<UserRolePage />);

      // Still disabled - need department and role
      expect(nextButton).toBeDisabled();

      // Step 2: Select department
      await waitFor(() => screen.getByTestId("department-select"));
      const deptDropdown = screen.getByTestId("department-select");
      await user.click(deptDropdown);
      const deptOption = await screen.findByText("Engineering");
      await user.click(deptOption);
      bookingContextValue.department = "Engineering";

      rerender(<UserRolePage />);

      // Still disabled - need role
      expect(nextButton).toBeDisabled();

      // Step 3: Select role
      await waitFor(() => screen.getByTestId("role-select"));
      const roleDropdown = screen.getByTestId("role-select");
      await user.click(roleDropdown);
      const roleOption = await screen.findByText("Student");
      await user.click(roleOption);
      bookingContextValue.role = "Student";

      rerender(<UserRolePage />);

      // Now should be enabled
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });

    it("handles 'Other' school selection requiring manual input", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn((val) => {
        bookingContextValue.role = val;
      });
      const setDepartment = vi.fn((val) => {
        bookingContextValue.department = val;
      });
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: null,
        department: null,
        setRole,
        setDepartment,
        setFormData,
        formData: {},
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      const nextButton = screen.getByRole("button", { name: /next/i });

      // Select "Other" school
      const schoolDropdown = screen.getByTestId("school-select");
      await user.click(schoolDropdown);
      const otherOption = await screen.findByText("Other");
      await user.click(otherOption);
      bookingContextValue.formData.school = "Other";

      // Should show text fields for manual entry
      await waitFor(() => {
        expect(screen.getByLabelText(/School/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Department/i)).toBeInTheDocument();
      });

      // Button should remain disabled until all fields are filled
      expect(nextButton).toBeDisabled();

      // Fill in other school
      const otherSchoolInput = screen.getByLabelText(/School/i);
      await user.type(otherSchoolInput, "Harvard");
      bookingContextValue.formData.otherSchool = "Harvard";

      // Still disabled - need department
      expect(nextButton).toBeDisabled();

      // Fill in other department
      const otherDeptInput = screen.getByLabelText(/Department/i);
      await user.type(otherDeptInput, "Computer Science");
      bookingContextValue.formData.otherDepartment = "Computer Science";

      // Still disabled - need role
      expect(nextButton).toBeDisabled();

      // Wait for and select role
      await waitFor(() => screen.getByTestId("role-select"));
      const roleDropdown = screen.getByTestId("role-select");
      await user.click(roleDropdown);
      const studentOption = await screen.findByText("Student");
      await user.click(studentOption);
      bookingContextValue.role = "Student";

      // Now should be enabled
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
      });
    });
  });

  describe("Automatic school mapping when department is auto-filled", () => {
    it("automatically sets school when auto-filled department maps to a single school", async () => {
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      // Start with auto-filled department that maps to exactly one school
      const bookingContextValue = {
        role: null,
        department: "Engineering", // Auto-filled, maps to "Tandon School of Engineering" only
        setRole,
        setDepartment,
        setFormData,
        formData: {}, // School not manually set yet
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      // Should auto-map school based on department
      await waitFor(() => {
        expect(setFormData).toHaveBeenCalledWith(
          expect.objectContaining({
            school: "Tandon School of Engineering",
            department: "Engineering",
          })
        );
      });

      // Next button should still be disabled until role is selected
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it("does not auto-set school when department maps to multiple schools", async () => {
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      // Create a scenario where a department maps to multiple schools
      const customSchoolMapping = {
        "School A": ["Engineering"],
        "School B": ["Engineering"], // Engineering appears in multiple schools
      };

      const customTenantSchema = {
        ...mockTenantSchema,
        schoolMapping: customSchoolMapping,
      };

      const bookingContextValue = {
        role: null,
        department: "Engineering", // Maps to multiple schools
        setRole,
        setDepartment,
        setFormData,
        formData: {},
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(
          bookingContextValue,
          {},
          {},
          customTenantSchema
        ) as any,
      });

      // Should NOT auto-set school when there are multiple matches
      await waitFor(() => {
        // Check that setFormData was not called with a school value
        const calls = setFormData.mock.calls;
        const hasSchoolSet = calls.some((call) => call[0]?.school);
        expect(hasSchoolSet).toBe(false);
      });
    });
  });

  describe("School selection affects department options", () => {
    it("filters department options based on selected school", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: null,
        department: null,
        setRole,
        setDepartment,
        setFormData,
        formData: {},
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      // Select "Tandon School of Engineering"
      const schoolDropdown = screen.getByTestId("school-select");
      await user.click(schoolDropdown);
      const schoolOption = await screen.findByText("Tandon School of Engineering");
      await user.click(schoolOption);

      // Wait for department dropdown to appear
      await waitFor(() => screen.getByTestId("department-select"));

      // Department dropdown should only show "Engineering" (not Arts or Business)
      const deptDropdown = screen.getByTestId("department-select");
      await user.click(deptDropdown);

      // Engineering should be available
      expect(await screen.findByText("Engineering")).toBeInTheDocument();

      // Arts should NOT be available (it's in a different school)
      expect(screen.queryByText("Arts")).not.toBeInTheDocument();
    });

    it("resets department when school changes and current department is not valid for new school", async () => {
      const user = userEvent.setup();
      const setRole = vi.fn();
      const setDepartment = vi.fn();
      const setFormData = vi.fn();

      const bookingContextValue = {
        role: null,
        department: "Engineering", // Currently set
        setRole,
        setDepartment,
        setFormData,
        formData: { school: "Tandon School of Engineering" },
        selectedRooms: [],
        bookingCalendarInfo: null,
      };

      const { rerender } = render(<UserRolePage />, {
        wrapper: createWrapper(bookingContextValue) as any,
      });

      // Change school to one that doesn't have Engineering
      const schoolDropdown = screen.getByTestId("school-select");
      await user.click(schoolDropdown);
      const artsSchool = await screen.findByText("Tisch School of the Arts");
      await user.click(artsSchool);

      // Department should be cleared because Engineering is not valid for Arts school
      await waitFor(() => {
        expect(setDepartment).toHaveBeenCalledWith("");
      });
    });
  });
});
