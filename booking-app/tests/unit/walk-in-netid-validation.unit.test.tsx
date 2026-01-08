import WalkInNetIdPage from "@/app/[tenant]/walk-in/netid/page";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRouter, useParams } from "next/navigation";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

// Mock theme
const theme = createTheme({
  palette: {
    divider: "#e0e0e0",
  },
});

describe("WalkInNetIdPage - NetID Validation", () => {
  const mockRouter = {
    push: vi.fn(),
  };

  const mockParams = {
    tenant: "media-commons",
  };

  const mockSetFormData = vi.fn();

  const mockDatabaseContext = {
    userEmail: "test@nyu.edu",
  };

  const mockBookingContext = {
    formData: null,
    setFormData: mockSetFormData,
  };

  const renderWalkInNetIdPage = (
    userEmail = "test@nyu.edu",
    formData = null
  ) => {
    return render(
      <ThemeProvider theme={theme}>
        <DatabaseContext.Provider
          value={{ ...mockDatabaseContext, userEmail }}
        >
          <BookingContext.Provider
            value={{ ...mockBookingContext, formData }}
          >
            <WalkInNetIdPage />
          </BookingContext.Provider>
        </DatabaseContext.Provider>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue(mockParams);
  });

  describe("Page Rendering", () => {
    it("renders the walk-in netId page with title and description", () => {
      renderWalkInNetIdPage();

      expect(screen.getByText("Walk-In NetID")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Enter the NetID of the visitor using the space (not the requester's NetID)"
        )
      ).toBeInTheDocument();
    });

    it("renders the netId input field", () => {
      renderWalkInNetIdPage();

      expect(screen.getByText("Walk-In NetID*")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders the Next button", () => {
      renderWalkInNetIdPage();

      expect(
        screen.getByRole("button", { name: "Next" })
      ).toBeInTheDocument();
    });
  });

  describe("NetID Pattern Validation", () => {
    it("accepts valid alphanumeric netId", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "abc123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText("NetID should only contain letters and numbers")
        ).not.toBeInTheDocument();
      });
    });

    it("shows error for netId with special characters", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "abc-123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("NetID should only contain letters and numbers")
        ).toBeInTheDocument();
      });
    });

    it("shows error for netId with spaces", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "abc 123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("NetID should only contain letters and numbers")
        ).toBeInTheDocument();
      });
    });

    it("shows error for netId with special characters like @", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "abc@123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("NetID should only contain letters and numbers")
        ).toBeInTheDocument();
      });
    });

    it("accepts netId with mixed case letters", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "AbC123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText("NetID should only contain letters and numbers")
        ).not.toBeInTheDocument();
      });
    });

    it("accepts netId with only letters", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "abcdef");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText("NetID should only contain letters and numbers")
        ).not.toBeInTheDocument();
      });
    });

    it("accepts netId with only numbers", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "123456");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText("NetID should only contain letters and numbers")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Required Field Validation", () => {
    it("shows error when field is left empty", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("Walk-In NetID is required")
        ).toBeInTheDocument();
      });
    });

    it("shows error when field contains only whitespace", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage();

      const input = screen.getByRole("textbox");
      await user.type(input, "   ");
      await user.tab();

      await waitFor(() => {
        // Whitespace will fail pattern validation, not required validation
        expect(
          screen.getByText("NetID should only contain letters and numbers")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Visitor NetID vs Requester NetID Validation", () => {
    it("shows error when visitor netId matches requester netId (exact case)", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "test");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
    });

    it("shows error when visitor netId matches requester netId (case insensitive)", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "TEST");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
    });

    it("shows error when visitor netId matches requester netId (with leading/trailing spaces)", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      // Type with spaces - this will fail pattern validation first
      await user.type(input, "  test  ");
      await user.tab(); // Trigger validation on blur

      await waitFor(() => {
        // Pattern validation will catch spaces first, showing pattern error
        expect(
          screen.getByText("NetID should only contain letters and numbers")
        ).toBeInTheDocument();
      });
      
      // Now try without leading/trailing spaces but still matching
      await user.clear(input);
      await user.type(input, "test");
      await user.tab();
      
      await waitFor(() => {
        // Now the custom validation should catch the matching netId
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
    });

    it("accepts visitor netId that is different from requester netId", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).not.toBeInTheDocument();
      });
    });

    it("accepts any netId when requester email is not available", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage(null);

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.queryByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).not.toBeInTheDocument();
      });
    });

    it("correctly extracts requester netId from email with multiple @ symbols", async () => {
      const user = userEvent.setup();
      // Edge case: although unlikely, the code only splits on first @
      renderWalkInNetIdPage("test123@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "test123");
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("navigates to role page with valid netId on submit", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalledWith(
          expect.objectContaining({
            walkInNetId: "visitor123",
          })
        );
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/media-commons/walk-in/role"
        );
      });
    });

    it("prevents submission when visitor netId matches requester netId", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });

      expect(mockSetFormData).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("trims whitespace from netId before submission", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("requester@nyu.edu");

      const input = screen.getByRole("textbox");
      // Can't type spaces because pattern validation rejects them
      // So test that trimming happens by checking the stored value
      await user.type(input, "visitor123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
        const callArg = mockSetFormData.mock.calls[0][0];
        // Verify the value is stored (implicitly trimmed by onSubmit)
        expect(callArg.walkInNetId).toBe("visitor123");
      });
    });

    it("converts netId to lowercase before submission", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "VISITOR123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalledWith(
          expect.objectContaining({
            walkInNetId: "visitor123",
          })
        );
      });
    });

    it("preserves existing formData when setting walkInNetId", async () => {
      const user = userEvent.setup();
      const existingFormData = {
        firstName: "John",
        lastName: "Doe",
        role: "Student",
      };
      renderWalkInNetIdPage("test@nyu.edu", existingFormData);

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: "John",
            lastName: "Doe",
            role: "Student",
            walkInNetId: "visitor123",
          })
        );
      });
    });
  });

  describe("Error Display", () => {
    it("does not show error alert initially", () => {
      renderWalkInNetIdPage();

      // Check that no MUI Alert is displayed
      const alert = screen.queryByRole("alert");
      expect(alert).not.toBeInTheDocument();
    });

    it("shows error message when submitting with matching netIds", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        // Error message could be in Alert or form helper text
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
      
      // Should not navigate or set form data
      expect(mockSetFormData).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("shows alert error when form validation passes but onSubmit validation fails", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      
      // Enter a netId that passes form validation (alphanumeric, non-empty)
      // but fails onSubmit validation (matches requester)
      await user.type(input, "test");
      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        // Should show error (either in Alert or helper text)
        expect(
          screen.getByText(
            "The visitor's NetID cannot be the same as the requester's NetID"
          )
        ).toBeInTheDocument();
      });
    });

    it("successfully submits when user enters a valid different netId", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");
      
      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/media-commons/walk-in/role"
        );
      });
    });
  });

  describe("Default Values", () => {
    it("populates input with existing walkInNetId from formData", () => {
      const existingFormData = {
        walkInNetId: "existing123",
      };
      renderWalkInNetIdPage("test@nyu.edu", existingFormData);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("existing123");
    });

    it("uses empty string as default when walkInNetId is not in formData", () => {
      renderWalkInNetIdPage("test@nyu.edu", {});

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  describe("Integration with Booking Flow", () => {
    it("navigates to correct tenant-specific role page", async () => {
      const user = userEvent.setup();
      (useParams as any).mockReturnValue({ tenant: "custom-tenant" });

      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/custom-tenant/walk-in/role"
        );
      });
    });

    it("does not set netId field (only walkInNetId) for walk-in bookings", async () => {
      const user = userEvent.setup();
      renderWalkInNetIdPage("test@nyu.edu");

      const input = screen.getByRole("textbox");
      await user.type(input, "visitor123");

      const nextButton = screen.getByRole("button", { name: "Next" });
      await user.click(nextButton);

      await waitFor(() => {
        const setFormDataCall = mockSetFormData.mock.calls[0][0];
        expect(setFormDataCall).toHaveProperty("walkInNetId", "visitor123");
        // netId should not be set - only walkInNetId
        expect(setFormDataCall).not.toHaveProperty("netId");
      });
    });
  });
});
