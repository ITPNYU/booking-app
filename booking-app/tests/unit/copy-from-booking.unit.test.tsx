import DetailsInput from "@/components/src/client/routes/booking/components/DetailsInput";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import {
  describeBooking,
  getCopyValues,
  pickLastBookingForRooms,
} from "@/components/src/client/routes/booking/utils/copyFromBooking";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel } from "@/components/src/types";
import { getPaginatedData } from "@/lib/firebase/firebase";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock("@/lib/firebase/firebase", () => ({
  getPaginatedData: vi.fn(),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({ default: vi.fn(() => ({ isAutoApproval: true })) }),
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useSubmitBooking",
  () => ({ default: vi.fn(() => vi.fn()) }),
);

const TENANT = "media-commons";

const pastBooking = {
  calendarEventId: "evt-1",
  title: "Spring Showcase",
  roomId: "221, 222",
  startDate: { toDate: () => new Date("2026-03-03T15:00:00") },
  sponsorFirstName: "Jane",
  sponsorLastName: "Doe",
  sponsorEmail: "jd12@nyu.edu",
  secondaryName: "Sam Lee Park",
  description: "End of term show",
  bookingType: "Event",
  attendeeAffiliation: "NYU Members with an active NYU ID",
  expectedAttendance: "15",
  productionSchedule: "Load-in at 2pm",
};

const theme = createTheme({
  palette: { custom: { border: "#e3e3e3", gray3: "#888888" } as any },
});

const schema = coerceTenantSchema(
  {
    tenantId: TENANT,
    tenant: { name: "Media Commons", logo: "", nameForPolicy: "MC" },
    policy: "",
    roles: ["Student", "Faculty", "Staff"],
    mappings: { program: {}, role: {}, school: {} },
    form: { showNNumber: false, showSponsor: true, showBookingType: true },
    attestations: [],
    resources: [],
    origins: { VIP: true, walkIn: true },
    resourceName: "Room",
  },
  TENANT,
);

function renderDetails(formContext = FormContextLevel.FULL_FORM) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={
          {
            userEmail: "abc123@nyu.edu",
            netId: "abc123",
            settings: {
              bookingTypes: [{ bookingType: "Event" }, { bookingType: "Class" }],
            },
            roomSettings: [{ roomId: "221", name: "Studio A" }],
          } as any
        }
      >
        <SchemaProvider value={schema}>
          <BookingContext.Provider
            value={
              {
                role: "Student",
                department: "ITP",
                selectedRooms: [{ roomId: "221", capacity: "40" }],
                formData: { role: "Student", title: "New event" },
                setFormData: vi.fn(),
                setIsDetailsValid: vi.fn(),
                checkedAgreements: {},
                setCheckedAgreements: vi.fn(),
              } as any
            }
          >
            <DetailsInput formContext={formContext} />
          </BookingContext.Provider>
        </SchemaProvider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getPaginatedData).mockReset();
  vi.mocked(getPaginatedData).mockResolvedValue([pastBooking]);
  (useRouter as any).mockReturnValue({ push: vi.fn() });
  (useParams as any).mockReturnValue({ tenant: TENANT });
});

describe("getCopyValues", () => {
  it("splits a legacy secondary contact name", () => {
    expect(getCopyValues(pastBooking, "secondaryContact", [])).toEqual({
      secondaryFirstName: "Sam",
      secondaryLastName: "Lee Park",
      secondaryEmail: "",
    });
  });

  it("drops a booking type the tenant no longer offers", () => {
    expect(
      getCopyValues(pastBooking, "reservation", ["Class"])?.bookingType,
    ).toBe("");
  });

  it("never copies title or production schedule", () => {
    const values = getCopyValues(pastBooking, "reservation", ["Event"]);
    expect(values).not.toHaveProperty("title");
    expect(values).not.toHaveProperty("productionSchedule");
  });

  it("offers nothing for a section the booking left empty", () => {
    expect(getCopyValues({ title: "x" }, "sponsor", [])).toBeNull();
  });

  it("describes a booking with its date", () => {
    expect(describeBooking(pastBooking)).toBe("Spring Showcase (Mar 3, 2026)");
  });
});

describe("pickLastBookingForRooms", () => {
  const at = (iso: string) => ({ toDate: () => new Date(iso) });
  const bookings = [
    { title: "Far future, other room", roomId: "300", requestedAt: at("2026-10-01") },
    { title: "Older here", roomId: "221", requestedAt: at("2026-01-01") },
    { title: "Newest here", roomId: "105, 221", requestedAt: at("2026-09-01") },
  ];

  it("picks the most recently requested booking in any selected room", () => {
    expect(pickLastBookingForRooms(bookings, ["221"])?.title).toBe(
      "Newest here",
    );
  });

  it("returns null when no booking used these rooms", () => {
    expect(pickLastBookingForRooms(bookings, ["999"])).toBeNull();
  });
});

describe("DetailsInput autofill from the last booking in these rooms", () => {
  it("looks up the requester's own bookings", async () => {
    renderDetails();
    await screen.findAllByText("Autofill last time");

    expect(getPaginatedData).toHaveBeenCalledWith(
      "bookings",
      20,
      expect.objectContaining({ userEmail: "abc123@nyu.edu" }),
      null,
      TENANT,
    );
    expect(screen.queryByDisplayValue("Jane")).not.toBeInTheDocument();
  });

  it("offers nothing when the user never booked these rooms", async () => {
    vi.mocked(getPaginatedData).mockResolvedValue([
      { ...pastBooking, roomId: "999" },
    ]);
    renderDetails();

    await waitFor(() => expect(getPaginatedData).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("Autofill last time")).not.toBeInTheDocument();
  });

  it("fills a section, then undoes back to what was there before", async () => {
    renderDetails();
    // Secondary contact, Sponsor, Reservation Details.
    expect(await screen.findAllByText("Autofill last time")).toHaveLength(3);

    const sponsorFirst = screen.getByLabelText(/Sponsor First Name/);
    fireEvent.change(sponsorFirst, { target: { value: "Typed" } });

    fireEvent.click(screen.getAllByText("Autofill last time")[1]);
    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jd12@nyu.edu")).toBeInTheDocument();
    expect(screen.getAllByText("Autofill last time")).toHaveLength(2);

    fireEvent.click(screen.getByText("Undo autofill"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("Typed")).toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("Jane")).not.toBeInTheDocument();
    expect(screen.getAllByText("Autofill last time")).toHaveLength(3);
  });

  it("clears an autofilled value's error when Undo empties the field", async () => {
    vi.mocked(getPaginatedData).mockResolvedValue([
      { ...pastBooking, sponsorEmail: "not-an-email" },
    ]);
    renderDetails();
    fireEvent.click((await screen.findAllByText("Autofill last time"))[1]);

    expect(
      await screen.findByText(/Invalid NYU Net ID email format/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Undo autofill"));
    await waitFor(() =>
      expect(
        screen.queryByText(/Invalid NYU Net ID email format/),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps the title and production schedule out of Reservation Details", async () => {
    renderDetails();
    fireEvent.click((await screen.findAllByText("Autofill last time"))[2]);

    expect(screen.getByDisplayValue("End of term show")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
    expect(screen.getByDisplayValue("New event")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Load-in at 2pm")).not.toBeInTheDocument();
  });

  it("is not offered on VIP requests", async () => {
    renderDetails(FormContextLevel.VIP);
    await new Promise((r) => setTimeout(r, 0));
    expect(getPaginatedData).not.toHaveBeenCalled();
    expect(screen.queryByText("Autofill last time")).not.toBeInTheDocument();
  });
});
