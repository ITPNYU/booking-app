import {
  BookingFormAgreementCheckbox,
  BookingFormDropdown,
  BookingFormSwitch,
  BookingFormTextField,
} from "@/components/src/client/routes/booking/components/BookingFormInputs";
import { Inputs } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

// Mock MUI theme
const theme = createTheme();

// Test wrapper component for form context
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

// Helper component to test form inputs with react-hook-form
function TestFormComponent({
  Component,
  componentProps,
}: {
  Component: React.ComponentType<any>;
  componentProps: any;
}) {
  const {
    control,
    formState: { errors },
    trigger,
  } = useForm<Inputs>({
    mode: "onBlur",
  });

  return (
    <TestWrapper>
      <Component
        control={control}
        errors={errors}
        trigger={trigger}
        {...componentProps}
      />
    </TestWrapper>
  );
}

describe("BookingFormInputs", () => {
  describe("BookingFormTextField", () => {
    it("renders text field with label", () => {
      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "firstName" as keyof Inputs,
            label: "First Name",
            required: true,
          }}
        />
      );

      expect(screen.getByText("First Name*")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("shows description when provided", () => {
      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "firstName" as keyof Inputs,
            label: "First Name",
            description: "Enter your first name",
            required: true,
          }}
        />
      );

      expect(screen.getByText("Enter your first name")).toBeInTheDocument();
    });

    it("handles optional fields correctly", () => {
      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "secondaryName" as keyof Inputs,
            label: "Secondary Name",
            required: false,
          }}
        />
      );

      expect(screen.getByText("Secondary Name")).toBeInTheDocument();
      expect(screen.queryByText("Secondary Name*")).not.toBeInTheDocument();
    });

    it("validates required fields", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "firstName" as keyof Inputs,
            label: "First Name",
            required: true,
          }}
        />
      );

      const input = screen.getByRole("textbox");
      await user.click(input);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText("First Name is required")).toBeInTheDocument();
      });
    });

    it("validates pattern when provided", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "nNumber" as keyof Inputs,
            label: "N-Number",
            pattern: {
              value: /^N[0-9]{8}$/,
              message: "Invalid N-Number format",
            },
            required: true,
          }}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "invalid");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText("Invalid N-Number format")).toBeInTheDocument();
      });
    });

    it("accepts valid input", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormTextField}
          componentProps={{
            id: "firstName" as keyof Inputs,
            label: "First Name",
            required: true,
          }}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "John");

      expect(input).toHaveValue("John");
    });
  });

  describe("BookingFormDropdown", () => {
    const options = ["Option 1", "Option 2", "Option 3"];

    it("renders dropdown with label and options", () => {
      render(
        <TestFormComponent
          Component={BookingFormDropdown}
          componentProps={{
            id: "bookingType" as keyof Inputs,
            label: "Booking Type",
            options,
            required: true,
          }}
        />
      );

      expect(screen.getByText("Booking Type*")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("shows placeholder text when no option selected", () => {
      render(
        <TestFormComponent
          Component={BookingFormDropdown}
          componentProps={{
            id: "bookingType" as keyof Inputs,
            label: "Booking Type",
            options,
            required: true,
          }}
        />
      );

      expect(screen.getByText("Select an option")).toBeInTheDocument();
    });

    it("opens dropdown and shows options when clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormDropdown}
          componentProps={{
            id: "bookingType" as keyof Inputs,
            label: "Booking Type",
            options,
            required: true,
          }}
        />
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      await waitFor(() => {
        options.forEach((option) => {
          expect(screen.getByText(option)).toBeInTheDocument();
        });
      });
    });

    it("selects option when clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormDropdown}
          componentProps={{
            id: "bookingType" as keyof Inputs,
            label: "Booking Type",
            options,
            required: true,
          }}
        />
      );

      const dropdown = screen.getByRole("combobox");
      await user.click(dropdown);

      const option = screen.getByText("Option 1");
      await user.click(option);

      expect(dropdown).toHaveTextContent("Option 1");
    });

    it("shows description when provided", () => {
      render(
        <TestFormComponent
          Component={BookingFormDropdown}
          componentProps={{
            id: "bookingType" as keyof Inputs,
            label: "Booking Type",
            options,
            description: "Choose your booking type",
            required: true,
          }}
        />
      );

      expect(screen.getByText("Choose your booking type")).toBeInTheDocument();
    });
  });

  describe("BookingFormSwitch", () => {
    it("renders switch with label", () => {
      render(
        <TestFormComponent
          Component={BookingFormSwitch}
          componentProps={{
            id: "catering" as keyof Inputs,
            label: "Catering",
            required: false,
          }}
        />
      );

      expect(screen.getByText("Catering")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
      expect(screen.getByText("No")).toBeInTheDocument();
    });

    it("toggles between Yes and No when clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestFormComponent
          Component={BookingFormSwitch}
          componentProps={{
            id: "catering" as keyof Inputs,
            label: "Catering",
            required: false,
          }}
        />
      );

      const switchElement = screen.getByRole("checkbox");
      expect(screen.getByText("No")).toBeInTheDocument();

      await user.click(switchElement);
      expect(screen.getByText("Yes")).toBeInTheDocument();

      await user.click(switchElement);
      expect(screen.getByText("No")).toBeInTheDocument();
    });

    it("shows description when provided", () => {
      const description = <p>Choose if you need catering</p>;

      render(
        <TestFormComponent
          Component={BookingFormSwitch}
          componentProps={{
            id: "catering" as keyof Inputs,
            label: "Catering",
            description,
            required: false,
          }}
        />
      );

      expect(
        screen.getByText("Choose if you need catering")
      ).toBeInTheDocument();
    });
  });

  describe("BookingFormAgreementCheckbox", () => {
    const mockOnChange = vi.fn();

    it("renders checkbox with description and agreement text", () => {
      render(
        <TestWrapper>
          <BookingFormAgreementCheckbox
            id="agreement1"
            checked={false}
            onChange={mockOnChange}
            description={<p>Terms and conditions apply</p>}
          />
        </TestWrapper>
      );

      expect(
        screen.getByText("Terms and conditions apply")
      ).toBeInTheDocument();
      expect(screen.getByText("I agree")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("calls onChange when clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingFormAgreementCheckbox
            id="agreement1"
            checked={false}
            onChange={mockOnChange}
            description={<p>Terms and conditions apply</p>}
          />
        </TestWrapper>
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it("reflects checked state", () => {
      render(
        <TestWrapper>
          <BookingFormAgreementCheckbox
            id="agreement1"
            checked={true}
            onChange={mockOnChange}
            description={<p>Terms and conditions apply</p>}
          />
        </TestWrapper>
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("handles HTML in description", () => {
      render(
        <TestWrapper>
          <BookingFormAgreementCheckbox
            id="agreement1"
            checked={false}
            onChange={mockOnChange}
            description={
              <div>
                <strong>Important:</strong> Please read carefully
              </div>
            }
          />
        </TestWrapper>
      );

      expect(screen.getByText("Important:")).toBeInTheDocument();
      expect(screen.getByText("Please read carefully")).toBeInTheDocument();
    });
  });
});
