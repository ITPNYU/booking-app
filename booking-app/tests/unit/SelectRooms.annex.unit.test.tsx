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
import { applyMcResourceServices } from "../../lib/tenant/mcResourceServices";

vi.mock(
  "../../components/src/client/routes/booking/hooks/useBookingDateRestrictions",
  () => ({
    useBookingDateRestrictions: () => ({
      isBookingTimeInBlackout: () => ({ inBlackout: false, affectedPeriods: [] }),
    }),
  }),
);

const room1201 = applyMcResourceServices({
  resourceId: "1201",
  name: "Seminar Room",
  capacity: 100,
  calendarId: "cal-1201",
  isEquipment: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: [],
}) as unknown as RoomSetting;

const room103 = applyMcResourceServices({
  resourceId: "103",
  name: "The Garage",
  capacity: 74,
  calendarId: "cal-103",
  isEquipment: false,
  isWalkIn: true,
  isWalkInCanBookTwo: false,
  services: [],
}) as unknown as RoomSetting;

// RoomSetting uses roomId; applyMcResourceServices returns resourceId.
(room1201 as any).roomId = "1201";
(room103 as any).roomId = "103";

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
    resources: rooms.map((r) => ({
      resourceId: String(r.roomId),
      name: r.name,
      capacity: Number(r.capacity),
      calendarId: r.calendarId,
      isEquipment: false,
      isWalkIn: false,
      isWalkInCanBookTwo: false,
      services: r.services,
    })),
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
      screen.getByRole("checkbox", { name: "Garage Green Room" }),
    ).toBeTruthy();
  });
});
