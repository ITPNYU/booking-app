import ServicesInput from "@/components/src/client/routes/booking/components/ServicesInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import type { ServiceDecisions } from "@/components/src/utils/serviceDecisions";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
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

const schema = coerceTenantSchema(
  {
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
  },
  "mc",
);

/** Two schema rooms, each offering staffing and catering. */
const schemaServices = {
  staffing: {
    label: "Staffing",
    staffingOptions: [{ value: "audio_tech", label: "Audio technician" }],
  },
  catering: { label: "Catering", chartField: { required: true } },
};
const room202 = { roomId: "202", capacity: "50", services: schemaServices };
const room203 = { roomId: "203", capacity: "50", services: schemaServices };

/** A legacy room whose catering is the tenant-level switch. */
const legacyCateringRoom = {
  roomId: "101",
  capacity: "50",
  services: ["catering"],
};

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
    selectedRooms: [room202, room203],
    annexByRoom: {},
    bookingCalendarInfo: calendarInfo,
    formData: null,
    setFormData: vi.fn(),
    setIsDetailsValid: vi.fn(),
    isBanned: false,
    needsSafetyTraining: false,
    isInBlackoutPeriod: false,
    serviceDecisions: {},
    ...overrides,
  }) as any;

const databaseContext = {
  userEmail: "test@nyu.edu",
  settings: { bookingTypes: [{ bookingType: "Event" }] },
} as any;

const renderServices = (
  formContext: FormContextLevel,
  serviceDecisions: ServiceDecisions,
  selectedRooms: unknown[] = [room202, room203],
) =>
  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={databaseContext}>
        <SchemaProvider value={schema}>
          <BookingContext.Provider
            value={bookingContext({ serviceDecisions, selectedRooms })}
          >
            <ServicesInput formContext={formContext} calendarEventId="evt1" />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );

/** "service:decision" for every decision mark on the page. */
const marks = () =>
  screen
    .queryAllByTestId("service-decision-mark")
    .map((el) => `${el.dataset.service}:${el.dataset.decision}`)
    .sort();

describe("Services step decision marks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
    (usePathname as any).mockReturnValue("/mc/edit/services/evt1");
  });

  it("marks every decided section on edit, once per room, and leaves pending ones unmarked", () => {
    renderServices(FormContextLevel.EDIT, { staff: true, catering: false });

    // Staffing renders once (first staffing-capable room); catering per room.
    expect(marks()).toEqual([
      "catering:declined",
      "catering:declined",
      "staff:approved",
    ]);
  });

  it("explains that changing an approved service sends it back for approval", () => {
    renderServices(FormContextLevel.EDIT, { staff: true });

    expect(screen.getByText("Approved.")).toBeInTheDocument();
    expect(
      screen.getByText(/Changing this service sends it back for approval/),
    ).toBeInTheDocument();
  });

  it("explains that an unchanged declined service stays declined", () => {
    renderServices(FormContextLevel.EDIT, { catering: false }, [room202]);

    expect(screen.getByText("Declined.")).toBeInTheDocument();
    expect(
      screen.getByText(/sends it back for review.*stays declined/),
    ).toBeInTheDocument();
  });

  it("shows the same marks in the modification context, without the reset note", () => {
    (usePathname as any).mockReturnValue("/mc/modification/services/evt1");
    renderServices(FormContextLevel.MODIFICATION, {
      staff: true,
      catering: false,
    });

    expect(marks()).toEqual([
      "catering:declined",
      "catering:declined",
      "staff:approved",
    ]);
    // Modification copies decisions forward unchanged (ADR-0001), so the
    // note about a change resetting the decision would be untrue here.
    expect(screen.getByText("Approved.")).toBeInTheDocument();
    expect(screen.queryByText(/sends it back/)).not.toBeInTheDocument();
  });

  it("marks the legacy tenant-level catering switch too", () => {
    renderServices(FormContextLevel.EDIT, { catering: true }, [
      legacyCateringRoom,
    ]);

    expect(marks()).toEqual(["catering:approved"]);
  });

  it("shows no marks for a booking without decisions", () => {
    renderServices(FormContextLevel.EDIT, {});

    expect(marks()).toEqual([]);
  });

  it.each([
    ["book", FormContextLevel.FULL_FORM],
    ["VIP", FormContextLevel.VIP],
    ["walk-in", FormContextLevel.WALK_IN],
  ])("shows no marks in the %s context", (_label, formContext) => {
    (usePathname as any).mockReturnValue("/mc/book/services");
    renderServices(formContext, { staff: true, catering: false });

    expect(marks()).toEqual([]);
  });
});
