import DetailsInput from "@/components/src/client/routes/booking/components/DetailsInput";
import ServicesInput from "@/components/src/client/routes/booking/components/ServicesInput";
import BookingFormStepper from "@/components/src/client/routes/booking/components/Stepper";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import useFormSteps from "@/components/src/client/routes/booking/hooks/useFormSteps";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import { createServiceRuleMemory } from "@/components/src/utils/serviceSections";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams, usePathname, useRouter } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({
    default: vi.fn(() => ({ isAutoApproval: true })),
  }),
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({
    default: vi.fn(() => vi.fn()),
  }),
);

const theme = createTheme({
  palette: {
    custom: { border: "#e3e3e3", gray3: "#888888" } as any,
  },
});

const rawSchema = {
  tenantId: "mc",
  tenant: { name: "Media Commons", logo: "", nameForPolicy: "Media Commons" },
  policy: "",
  roles: ["Student", "Faculty", "Staff"],
  mappings: { program: {}, role: {}, school: {} },
  form: {
    showNNumber: true,
    showSponsor: true,
    showBookingType: true,
    services: {
      showSetup: false,
      showEquipment: true,
      showStaffing: true,
      showCatering: true,
      showSecurity: true,
    },
  },
  attestations: [{ id: "agreement1", html: "<p>I agree</p>" }],
  resources: [],
  origins: { VIP: true, walkIn: true },
  resourceName: "Room",
};
const schema = coerceTenantSchema(rawSchema, "mc");

/** A legacy room offering security: the Services step has a section to show. */
const securityRoom = {
  roomId: "101",
  capacity: "200",
  services: ["security"],
};
/** A room with an empty services config and no tenant setup switch: nothing to show. */
const bareRoom = { roomId: "102", capacity: "20", services: {} };

const calendarInfo = {
  startStr: "2024-01-01T09:00:00",
  endStr: "2024-01-01T10:00:00",
  start: new Date("2024-01-01T09:00:00"),
  end: new Date("2024-01-01T10:00:00"),
};

const bookingContext = (overrides: Record<string, unknown> = {}) =>
  ({
    role: "Faculty",
    department: "ITP",
    selectedRooms: [securityRoom],
    annexByRoom: {},
    bookingCalendarInfo: calendarInfo,
    formData: null,
    setFormData: vi.fn(),
    setIsDetailsValid: vi.fn(),
    checkedAgreements: {},
    setCheckedAgreements: vi.fn(),
    isBanned: false,
    needsSafetyTraining: false,
    isInBlackoutPeriod: false,
    ...overrides,
  }) as any;

const databaseContext = {
  userEmail: "test@nyu.edu",
  settings: { bookingTypes: [{ bookingType: "Event" }] },
} as any;

const wrap = (ui: React.ReactElement, context = bookingContext()) => (
  <ThemeProvider theme={theme}>
    <DatabaseContext.Provider value={databaseContext}>
      <SchemaProvider value={schema}>
        <BookingContext.Provider value={context}>{ui}</BookingContext.Provider>
      </SchemaProvider>
    </DatabaseContext.Provider>
  </ThemeProvider>
);

describe("Details step", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push });
    (useParams as any).mockReturnValue({ tenant: "mc" });
    (usePathname as any).mockReturnValue("/mc/book/form");
  });

  it("ends with Next when the Services step follows", () => {
    render(wrap(<DetailsInput formContext={FormContextLevel.FULL_FORM} />));
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.queryByText("Agreement")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the submit block when no service section would show", () => {
    render(
      wrap(
        <DetailsInput formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({ selectedRooms: [bareRoom] }),
      ),
    );
    expect(screen.getByText("Agreement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next" }),
    ).not.toBeInTheDocument();
  });

  it("does not move on while the Details answer set is invalid", async () => {
    const user = userEvent.setup();
    render(wrap(<DetailsInput formContext={FormContextLevel.FULL_FORM} />));

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(push).not.toHaveBeenCalled();
  });

  it("moves on to the Services step once the answers validate", async () => {
    const user = userEvent.setup();
    const setIsDetailsValid = vi.fn();
    (usePathname as any).mockReturnValue("/mc/modification/form/evt1");
    render(
      wrap(
        <DetailsInput
          formContext={FormContextLevel.MODIFICATION}
          calendarEventId="evt1"
        />,
        bookingContext({ setIsDetailsValid }),
      ),
    );

    await user.type(screen.getByLabelText(/Reservation Title/), "Demo");
    await user.type(screen.getByLabelText(/Reservation Description/), "A demo");
    await user.type(screen.getByLabelText(/Expected Attendance/), "5");
    // Validation runs on blur.
    await user.tab();

    const next = screen.getByRole("button", { name: "Next" });
    await waitFor(() => expect(next).toBeEnabled(), { timeout: 3000 });
    // A valid form alone records nothing: only Next's validation does.
    expect(setIsDetailsValid).not.toHaveBeenCalledWith(true);

    await user.click(next);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/mc/modification/services/evt1"),
    );
    expect(setIsDetailsValid).toHaveBeenLastCalledWith(true);

    // An edit withdraws validity right away, without waiting for a blur:
    // leaving through browser history never fires one.
    await user.clear(screen.getByLabelText(/Reservation Title/));
    expect(setIsDetailsValid).toHaveBeenLastCalledWith(false);
  });
});

describe("Services step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
    (usePathname as any).mockReturnValue("/mc/book/services");
  });

  it("renders the submit block after the service sections", () => {
    render(wrap(<ServicesInput formContext={FormContextLevel.FULL_FORM} />));
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Agreement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
  });

  it("locks security on when expected attendance is 75 or more", async () => {
    const { container } = render(
      wrap(
        <ServicesInput formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({ formData: { expectedAttendance: "80" } }),
      ),
    );

    const securitySwitch = container.querySelector(
      "#hireSecurity",
    ) as HTMLInputElement;
    await waitFor(() => expect(securitySwitch).toBeChecked());
    expect(securitySwitch).toBeDisabled();
    expect(
      screen.getByText(/Security is required for events with more than 75/),
    ).toBeInTheDocument();
  });

  it("releases a rule-forced security answer after attendance is lowered on Details", async () => {
    // The Services step unmounts while attendance is edited on Details, so
    // the rule's bookkeeping must survive in BookingContext.
    const serviceRuleMemory = createServiceRuleMemory();
    const setFormData = vi.fn();
    const first = render(
      wrap(
        <ServicesInput formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({
          formData: { expectedAttendance: "80" },
          setFormData,
          serviceRuleMemory,
        }),
      ),
    );
    await waitFor(() =>
      expect(setFormData).toHaveBeenLastCalledWith(
        expect.objectContaining({ hireSecurity: "yes" }),
      ),
    );
    const answers = setFormData.mock.calls.at(-1)?.[0];
    first.unmount();

    const { container } = render(
      wrap(
        <ServicesInput formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({
          formData: { ...answers, expectedAttendance: "40" },
          setFormData,
          serviceRuleMemory,
        }),
      ),
    );

    const securitySwitch = container.querySelector(
      "#hireSecurity",
    ) as HTMLInputElement;
    await waitFor(() => expect(securitySwitch).not.toBeChecked());
    expect(securitySwitch).not.toBeDisabled();
  });

  it("leaves security unlocked below the attendance threshold", () => {
    const { container } = render(
      wrap(
        <ServicesInput formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({ formData: { expectedAttendance: "10" } }),
      ),
    );

    const securitySwitch = container.querySelector(
      "#hireSecurity",
    ) as HTMLInputElement;
    expect(securitySwitch).not.toBeDisabled();
    expect(securitySwitch).not.toBeChecked();
    expect(
      screen.queryByText(/Security is required for events with more than 75/),
    ).not.toBeInTheDocument();
  });
});

describe("Stepper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
  });

  const labels = () =>
    screen
      .getAllByText(
        /^(NetID|Affiliation|Select Time|Details|Services|Confirmation)$/,
      )
      .map((el) => el.textContent);

  it("lists Services between Details and Confirmation when a section would show", () => {
    (usePathname as any).mockReturnValue("/mc/book/services");
    render(
      wrap(<BookingFormStepper formContext={FormContextLevel.FULL_FORM} />),
    );
    expect(labels()).toEqual([
      "Affiliation",
      "Select Time",
      "Details",
      "Services",
      "Confirmation",
    ]);
  });

  it("hides the Services label when the step is skipped", () => {
    (usePathname as any).mockReturnValue("/mc/book/form");
    render(
      wrap(
        <BookingFormStepper formContext={FormContextLevel.FULL_FORM} />,
        bookingContext({ selectedRooms: [bareRoom] }),
      ),
    );
    expect(labels()).toEqual([
      "Affiliation",
      "Select Time",
      "Details",
      "Confirmation",
    ]);
  });

  it("keeps the Services label before any room is selected", () => {
    (usePathname as any).mockReturnValue("/mc/walk-in/role");
    render(
      wrap(
        <BookingFormStepper formContext={FormContextLevel.WALK_IN} />,
        bookingContext({ selectedRooms: [] }),
      ),
    );
    expect(labels()).toEqual([
      "NetID",
      "Affiliation",
      "Select Time",
      "Details",
      "Services",
      "Confirmation",
    ]);
  });
});

describe("useFormSteps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
  });

  const hook = (formContext: FormContextLevel, context = bookingContext()) =>
    renderHook(() => useFormSteps(formContext), {
      wrapper: ({ children }) => wrap(<>{children}</>, context),
    }).result.current;

  it("walks Details → Services → Confirmation for the Header buttons", () => {
    (usePathname as any).mockReturnValue("/mc/book/services");
    const state = hook(FormContextLevel.FULL_FORM);
    expect(state.currentStep).toBe("services");
    expect(state.previousStep).toBe("form");
    expect(state.nextStep).toBe("confirmation");
  });

  it("goes straight from Details to Confirmation when Services is skipped", () => {
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const state = hook(
      FormContextLevel.EDIT,
      bookingContext({ selectedRooms: [bareRoom] }),
    );
    expect(state.hasServicesStep).toBe(false);
    expect(state.nextStep).toBe("confirmation");
  });

  it("has no previous step on the first step of a modification", () => {
    (usePathname as any).mockReturnValue("/mc/modification/selectRoom/evt1");
    const state = hook(FormContextLevel.MODIFICATION);
    expect(state.previousStep).toBeNull();
    expect(state.nextStep).toBe("form");
  });
});
