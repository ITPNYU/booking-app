import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  FormContextLevel,
  Role,
  RoomSetting,
} from "../../components/src/types";
import {
  SchemaContext,
  generateDefaultSchema,
} from "../../components/src/client/routes/components/SchemaProvider";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import { SelectRooms } from "../../components/src/client/routes/booking/components/SelectRooms";

vi.mock(
  "../../components/src/client/routes/booking/hooks/useBookingDateRestrictions",
  () => ({
    useBookingDateRestrictions: () => ({
      isBookingTimeInBlackout: () => ({ inBlackout: false, affectedPeriods: [] }),
    }),
  }),
);

const room1201 = {
  resourceId: "1201",
  roomId: "1201",
  name: "Seminar Room",
  capacity: 100,
  calendarId: "cal-1201",
  isEquipment: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: {},
} as unknown as RoomSetting;

const room103 = {
  resourceId: "103",
  roomId: "103",
  name: "The Garage",
  capacity: 74,
  calendarId: "cal-103",
  isEquipment: false,
  isWalkIn: true,
  isWalkInCanBookTwo: false,
  services: {},
} as unknown as RoomSetting;

// Annex spaces are schema resources pointing at their parent room.
const annexResources = [
  {
    resourceId: "1200L-6",
    name: "Seminar Foyer",
    parentResourceId: "1201",
    capacity: 10,
    calendarId: "cal-1200l6",
    services: {},
  },
  {
    resourceId: "1202",
    name: "Seminar Breakout",
    parentResourceId: "1201",
    capacity: 10,
    calendarId: "cal-1202",
    services: {},
  },
  {
    resourceId: "1204",
    name: "Seminar Lounge",
    parentResourceId: "1201",
    capacity: 10,
    calendarId: "cal-1204",
    services: {},
  },
  {
    resourceId: "103GR",
    name: "Garage Green Room",
    parentResourceId: "103",
    capacity: 5,
    calendarId: "cal-103gr",
    services: {},
  },
];

function TestHarness({
  role,
  rooms = [room1201, room103],
}: {
  role?: Role;
  rooms?: RoomSetting[];
}) {
  const [selected, setSelected] = useState<RoomSetting[]>([]);
  const [annexByRoom, setAnnexByRoom] = useState<Record<string, string[]>>({});
  const schema = {
    ...generateDefaultSchema("mc"),
    resources: [
      ...rooms.map((r) => ({
        resourceId: String(r.roomId),
        name: r.name,
        capacity: Number(r.capacity),
        calendarId: r.calendarId,
        isEquipment: false,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: r.services,
      })),
      ...annexResources,
    ],
    calendarConfig: {
      ...generateDefaultSchema("mc").calendarConfig,
      multipleResourceSelect: true,
    },
  };

  return (
    <SchemaContext.Provider value={schema as any}>
      <BookingContext.Provider
        value={{
          hasShownMocapModal: false,
          setHasShownMocapModal: () => {},
          bookingCalendarInfo: undefined,
          setBookingCalendarInfo: () => {},
          role,
          annexByRoom,
          setAnnexByRoom,
        } as any}
      >
        <SelectRooms
          allRooms={rooms}
          formContext={FormContextLevel.FULL_FORM}
          selected={selected}
          setSelected={setSelected}
        />
        <div data-testid="annex-state">{JSON.stringify(annexByRoom)}</div>
      </BookingContext.Provider>
    </SchemaContext.Provider>
  );
}

describe("SelectRooms auxiliary spaces", () => {
  it("shows indented annex options for faculty when parent is selected", () => {
    render(<TestHarness role={Role.FACULTY} />);

    expect(screen.queryByTestId("annex-options-1201")).toBeNull();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "1201 Seminar Room" }),
    );

    expect(screen.getByTestId("annex-options-1201")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "1202 Seminar Breakout" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "1200L-6 Seminar Foyer" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "1204 Seminar Lounge" }),
    ).toBeTruthy();
  });

  it("hides annex options for students even when parent is selected", () => {
    render(<TestHarness role={Role.STUDENT} />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "1201 Seminar Room" }),
    );

    expect(screen.queryByTestId("annex-options-1201")).toBeNull();
    expect(
      screen.queryByRole("checkbox", { name: "1200L-6 Seminar Foyer" }),
    ).toBeNull();
  });

  it("clears annex selections when parent is deselected", () => {
    render(<TestHarness role={Role.ADMIN_STAFF} />);

    const parent = screen.getByRole("checkbox", {
      name: "1201 Seminar Room",
    });
    fireEvent.click(parent);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "1200L-6 Seminar Foyer" }),
    );

    expect(screen.getByTestId("annex-state").textContent).toContain("1200L-6");

    fireEvent.click(parent);
    expect(screen.getByTestId("annex-state").textContent).toBe("{}");
  });

  it("shows schema-driven annex options for 103 green room", () => {
    render(<TestHarness role={Role.FACULTY} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "103 The Garage" }));

    expect(screen.getByTestId("annex-options-103")).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "103GR Garage Green Room" }),
    ).toBeTruthy();
  });
});
