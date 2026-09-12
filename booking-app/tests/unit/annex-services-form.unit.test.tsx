import FormInput from "@/components/src/client/routes/booking/components/FormInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import {
  getSelectedAnnexResources,
  getServiceRooms,
} from "@/components/src/utils/resourceServicesUtils";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
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

// 1201 offers 1200L-6 as an annex checkbox; 1200L-6 has its own services.
const room1201 = {
  resourceId: "1201",
  name: "Seminar Room",
  capacity: 100,
  calendarId: "cal-1201",
  isEquipment: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: {
    annex: {
      label: "Request breakout space, lounge, or foyer",
      mode: "checkbox",
      options: [{ value: "1200L-6", label: "1200L-6 Seminar Foyer" }],
    },
  },
};

const FOYER_SECURITY_LABEL = "Hire Campus Safety for the Seminar Foyer";

const annex1200L6 = {
  resourceId: "1200L-6",
  name: "Seminar Foyer",
  parentResourceId: "1201",
  capacity: 10,
  calendarId: "cal-1200l6",
  isEquipment: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: {
    security: {
      label: FOYER_SECURITY_LABEL,
      descriptionHtml: "<p>Chartfield for Campus Safety services</p>",
      mode: "checkbox",
      options: [{ value: "yes", label: "Yes, hire Campus Safety" }],
      chartField: { required: true },
    },
  },
};

const annex1202 = {
  resourceId: "1202",
  name: "Seminar Breakout",
  parentResourceId: "1201",
  capacity: 10,
  calendarId: "cal-1202",
  isEquipment: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: {},
};

describe("getSelectedAnnexResources / getServiceRooms", () => {
  const resources = [room1201, annex1200L6, annex1202];

  it("resolves checked annex IDs to their registered resources, sorted", () => {
    const result = getSelectedAnnexResources(
      { "1201": ["1202", "1200L-6"] },
      resources,
    );
    expect(result.map((r) => r.resourceId)).toEqual(["1200L-6", "1202"]);
  });

  it("ignores empty, malformed, unknown and non-annex values", () => {
    expect(getSelectedAnnexResources(undefined, resources)).toEqual([]);
    expect(getSelectedAnnexResources({}, resources)).toEqual([]);
    expect(
      getSelectedAnnexResources({ "1201": "1200L-6" as any }, resources),
    ).toEqual([]);
    // "1201" is a top-level room and "9999" is unregistered.
    expect(
      getSelectedAnnexResources({ "1201": ["1201", "9999", ""] }, resources),
    ).toEqual([]);
  });

  it("appends checked annex rooms after the selected rooms", () => {
    const selected = [{ roomId: "1201", services: room1201.services }];
    const rooms = getServiceRooms(
      selected,
      { "1201": ["1200L-6"] },
      resources,
    );
    expect(rooms).toHaveLength(2);
    expect(rooms[0]).toBe(selected[0]);
    expect(rooms[1].resourceId).toBe("1200L-6");
  });

  it("returns the selected rooms unchanged when nothing is checked", () => {
    const selected = [{ roomId: "1201", services: room1201.services }];
    expect(getServiceRooms(selected, {}, resources)).toBe(selected);
    expect(getServiceRooms(selected, undefined, resources)).toBe(selected);
  });

  it("does not duplicate a room that is both selected and checked", () => {
    const selected = [{ roomId: "1200L-6", services: annex1200L6.services }];
    const rooms = getServiceRooms(
      selected,
      { "1201": ["1200L-6"] },
      resources,
    );
    expect(rooms).toHaveLength(1);
  });
});

describe("FormInput renders services for checked annex spaces", () => {
  const schema = coerceTenantSchema(
    {
      tenantId: "mc",
      tenant: { name: "Media Commons", logo: "", nameForPolicy: "Media Commons" },
      policy: "",
      roles: ["Student"],
      mappings: { program: {}, role: {}, school: {} },
      form: {
        showNNumber: false,
        showSponsor: false,
        showBookingType: false,
        services: {
          showSetup: false,
          showEquipment: false,
          showStaffing: false,
          showCatering: false,
          showSecurity: false,
        },
      },
      attestations: [],
      resources: [room1201, annex1200L6, annex1202],
      origins: { VIP: true, walkIn: true },
      resourceName: "Room",
    },
    "mc",
  );

  const selectedRoom1201 = {
    roomId: "1201",
    name: "Seminar Room",
    capacity: "100",
    calendarId: "cal-1201",
    services: room1201.services,
  };

  const renderForm = (annexByRoom: Record<string, string[]>) =>
    render(
      <ThemeProvider theme={theme}>
        <DatabaseContext.Provider
          value={{ userEmail: "test@nyu.edu", settings: { bookingTypes: [] } } as any}
        >
          <SchemaProvider value={schema}>
            <BookingContext.Provider
              value={
                {
                  role: "Student",
                  department: "ITP",
                  selectedRooms: [selectedRoom1201],
                  annexByRoom,
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
                } as any
              }
            >
              <FormInput formContext={FormContextLevel.FULL_FORM} />
            </BookingContext.Provider>
          </SchemaProvider>
        </DatabaseContext.Provider>
      </ThemeProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (useParams as any).mockReturnValue({ tenant: "mc" });
  });

  it("shows the annex room's own services once it is checked under its parent", () => {
    renderForm({ "1201": ["1200L-6"] });
    expect(screen.getByText("1200L-6 Seminar Foyer")).toBeInTheDocument();
    expect(screen.getByText(FOYER_SECURITY_LABEL)).toBeInTheDocument();
  });

  it("does not show annex services when no annex space is checked", () => {
    renderForm({});
    expect(screen.queryByText("1200L-6 Seminar Foyer")).not.toBeInTheDocument();
    expect(screen.queryByText(FOYER_SECURITY_LABEL)).not.toBeInTheDocument();
  });
});
