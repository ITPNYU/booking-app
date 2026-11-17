import DetailsInput from "@/components/src/client/routes/booking/components/DetailsInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { FormContextLevel } from "@/components/src/types";
import { formatDepartmentCollaboration } from "@/components/src/utils/formatters";
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

const theme = createTheme({
  palette: { custom: { border: "#e3e3e3", gray3: "#888888" } as any },
});

const QUESTION = "Is this a collaboration between two or more departments?*";

const setFormData = vi.fn();

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
  formData: null,
  setFormData,
  setIsDetailsValid: vi.fn(),
  checkedAgreements: {},
  setCheckedAgreements: vi.fn(),
  isBanned: false,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
};

const mcSchema = (formOverrides: Record<string, unknown> = {}) =>
  coerceTenantSchema(
    {
      tenantId: "mc",
      roles: ["Student", "Faculty", "Staff"],
      mappings: {
        program: { MARL: ["MARL"], IDM: ["IDM"], "Game Center": ["GAMES"] },
        role: {},
        school: {},
      },
      form: { showBookingType: true, ...formOverrides },
      resources: [],
    },
    "mc",
  );

const renderDetails = (
  schema = mcSchema(),
  formContext = FormContextLevel.FULL_FORM,
) =>
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
            <DetailsInput formContext={formContext} userApiData={undefined} />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );

const chooseCollaboration = async (
  user: ReturnType<typeof userEvent.setup>,
  answer: "Yes" | "No",
) => {
  await user.click(
    within(screen.getByTestId("department-collaboration-select")).getByRole(
      "combobox",
    ),
  );
  await user.click(screen.getByRole("option", { name: answer }));
};

/** The form values last pushed to the booking context. */
const latestFormData = () =>
  setFormData.mock.calls[setFormData.mock.calls.length - 1]?.[0] ?? {};

describe("department collaboration question (#1383)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
  });

  it("is on for Media Commons and off for other tenants by default", () => {
    expect(generateDefaultSchema("mc").form.showDepartmentCollaboration).toBe(
      true,
    );
    expect(generateDefaultSchema("itp").form.showDepartmentCollaboration).toBe(
      false,
    );
  });

  it("lets a stored tenant schema turn it off", () => {
    expect(
      mcSchema({ showDepartmentCollaboration: false }).form
        .showDepartmentCollaboration,
    ).toBe(false);
  });

  it("asks the question under Booking Type, without the department list yet", () => {
    renderDetails();

    const labels = screen
      .getAllByText(/Booking Type\*|collaboration between two or more/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["Booking Type*", QUESTION]);
    expect(
      screen.queryByText("Collaborating Departments*"),
    ).not.toBeInTheDocument();
  });

  it("is hidden when the tenant schema turns it off", () => {
    renderDetails(mcSchema({ showDepartmentCollaboration: false }));

    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it("is not asked on a modification", () => {
    renderDetails(mcSchema(), FormContextLevel.MODIFICATION);

    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it("asks which departments on Yes, and allows picking several", async () => {
    const user = userEvent.setup();
    renderDetails();

    await chooseCollaboration(user, "Yes");

    expect(
      await screen.findByText("Collaborating Departments*"),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByTestId("collaborating-departments-select")).getByRole(
        "combobox",
      ),
    );
    const menu = screen.getByTestId("collaborating-departments-select-menu");
    expect(
      within(menu)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Game Center", "IDM", "MARL", "Other"]);

    await user.click(within(menu).getByRole("option", { name: "IDM" }));
    await user.click(within(menu).getByRole("option", { name: "MARL" }));

    await waitFor(() =>
      expect(latestFormData()).toMatchObject({
        departmentCollaboration: "Yes",
        collaboratingDepartments: ["IDM", "MARL"],
      }),
    );
  });

  it("drops the picked departments when the answer changes to No", async () => {
    const user = userEvent.setup();
    renderDetails();

    await chooseCollaboration(user, "Yes");
    await user.click(
      within(
        await screen.findByTestId("collaborating-departments-select"),
      ).getByRole("combobox"),
    );
    await user.click(screen.getByRole("option", { name: "IDM" }));
    await user.keyboard("{Escape}");

    await chooseCollaboration(user, "No");

    expect(
      screen.queryByText("Collaborating Departments*"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(latestFormData()).toMatchObject({
        departmentCollaboration: "No",
        collaboratingDepartments: [],
      }),
    );
  });
  it("asks for the department name when Other is picked, and drops it when Other is unticked", async () => {
    const user = userEvent.setup();
    renderDetails();

    await chooseCollaboration(user, "Yes");
    const openDepartments = async () =>
      user.click(
        within(
          await screen.findByTestId("collaborating-departments-select"),
        ).getByRole("combobox"),
      );
    await openDepartments();
    await user.click(screen.getByRole("option", { name: "IDM" }));
    await user.click(screen.getByRole("option", { name: "Other" }));
    await user.keyboard("{Escape}");

    expect(
      await screen.findByText("Other Collaborating Department(s)*"),
    ).toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", {
        name: /Other Collaborating Department/,
      }),
      "Tisch Drama",
    );
    await waitFor(() =>
      expect(latestFormData()).toMatchObject({
        collaboratingDepartments: ["IDM", "Other"],
        otherCollaboratingDepartments: "Tisch Drama",
      }),
    );

    await openDepartments();
    await user.click(screen.getByRole("option", { name: "Other" }));
    await user.keyboard("{Escape}");

    expect(
      screen.queryByText("Other Collaborating Department(s)*"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(latestFormData()).toMatchObject({
        collaboratingDepartments: ["IDM"],
        otherCollaboratingDepartments: "",
      }),
    );
  });

  it("requires the Other department name", async () => {
    const user = userEvent.setup();
    renderDetails();

    await chooseCollaboration(user, "Yes");
    await user.click(
      within(
        await screen.findByTestId("collaborating-departments-select"),
      ).getByRole("combobox"),
    );
    await user.click(screen.getByRole("option", { name: "Other" }));
    await user.keyboard("{Escape}");
    const field = await screen.findByRole("textbox", {
      name: /Other Collaborating Department/,
    });
    await user.type(field, "   ");
    await user.tab();

    expect(
      await screen.findByText(
        "Other Collaborating Department(s) cannot be empty whitespace",
      ),
    ).toBeInTheDocument();
  });
});

describe("formatDepartmentCollaboration", () => {
  it("names the Other department(s) in the details", () => {
    expect(
      formatDepartmentCollaboration({
        departmentCollaboration: "Yes",
        collaboratingDepartments: ["IDM", "Other"],
        otherCollaboratingDepartments: " Tisch Drama ",
      }),
    ).toBe("Yes: IDM, Other (Tisch Drama)");
  });

  it("shows No, and nothing for bookings that were never asked", () => {
    expect(
      formatDepartmentCollaboration({ departmentCollaboration: "No" }),
    ).toBe("No");
    expect(formatDepartmentCollaboration({})).toBeUndefined();
  });
});
