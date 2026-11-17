import DetailsInput from "@/components/src/client/routes/booking/components/DetailsInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({ default: vi.fn(() => ({ isAutoApproval: true })) }),
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({
    default: vi.fn(() => vi.fn()),
  }),
);

// Next goes on to Services, so a passing submit shows up as a route push.
vi.mock(
  "@/components/src/client/routes/booking/hooks/useFormSteps",
  async (importOriginal) => ({
    ...(await importOriginal<any>()),
    useHasServicesStep: () => true,
  }),
);

const theme = createTheme({
  palette: { custom: { border: "#e3e3e3", gray3: "#888888" } as any },
});

const schema = coerceTenantSchema(
  {
    tenantId: "mc",
    roles: ["Faculty"],
    mappings: { program: { IDM: ["IDM"] }, role: {}, school: {} },
    form: { showBookingType: true },
    resources: [],
  },
  "mc",
);

// Every other Details answer is already valid, so only the collaboration
// fields decide whether Next goes through.
const bookingContext = {
  role: "Faculty",
  department: "IDM",
  selectedRooms: [{ roomId: "233", capacity: "20", services: [] }],
  bookingCalendarInfo: {
    startStr: "2026-11-02T09:00:00",
    endStr: "2026-11-02T10:00:00",
    start: new Date("2026-11-02T09:00:00"),
    end: new Date("2026-11-02T10:00:00"),
  },
  formData: {
    firstName: "Local",
    lastName: "Tester",
    nNumber: "N12345678",
    netId: "lt123",
    phoneNumber: "2125551234",
    title: "Workshop",
    description: "Testing",
    bookingType: "Workshop",
    expectedAttendance: "5",
    attendeeAffiliation: "NYU Members with an active NYU ID",
  },
  setFormData: vi.fn(),
  setIsDetailsValid: vi.fn(),
  checkedAgreements: {},
  setCheckedAgreements: vi.fn(),
  isBanned: false,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
};

const push = vi.fn();

const renderDetails = () =>
  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={
          {
            userEmail: "test@nyu.edu",
            settings: { bookingTypes: [{ bookingType: "Workshop" }] },
          } as any
        }
      >
        <SchemaProvider value={schema}>
          <BookingContext.Provider value={bookingContext as any}>
            <DetailsInput
              formContext={FormContextLevel.FULL_FORM}
              userApiData={undefined}
            />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );

const setUp = async () => {
  const user = userEvent.setup();
  renderDetails();
  const answer = async (value: "Yes" | "No") => {
    await user.click(
      within(screen.getByTestId("department-collaboration-select")).getByRole(
        "combobox",
      ),
    );
    await user.click(screen.getByRole("option", { name: value }));
  };

  // Yes, then Other, then leave the Other name blank so its error shows.
  await answer("Yes");
  await user.click(
    within(
      await screen.findByTestId("collaborating-departments-select"),
    ).getByRole("combobox"),
  );
  await user.click(screen.getByRole("option", { name: "Other" }));
  await user.keyboard("{Escape}");
  await user.click(
    await screen.findByRole("textbox", { name: /Other Collaborating/ }),
  );
  await user.tab();

  const next = () =>
    user.click(screen.getByRole("button", { name: /Next|Submit/ }));
  return { answer, next };
};

describe("department collaboration and the Next button (#1383)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push });
    (useParams as any).mockReturnValue({ tenant: "mc" });
  });

  it("stops Next while the Other department name is missing", async () => {
    const { next } = await setUp();

    await next();

    expect(
      await screen.findByText("Other Collaborating Department(s) is required"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("lets Next through after answering No hides the department fields", async () => {
    const { answer, next } = await setUp();

    await answer("No");
    await next();

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText(/^Other Collaborating Department\(s\) is required$/),
    ).not.toBeInTheDocument();
  });
});
