import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FormContextLevel, RoomSetting } from "../../components/src/types";
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

const rooms: RoomSetting[] = [
  {
    roomId: 202,
    name: "Lecture Hall",
    capacity: "30",
    calendarId: "cal-202",
    isEquipment: false,
  } as RoomSetting,
  {
    roomId: 203,
    name: "Seminar Room",
    capacity: "20",
    calendarId: "cal-203",
    isEquipment: false,
  } as RoomSetting,
];

function TestHarness({ multipleResourceSelect }: { multipleResourceSelect: boolean }) {
  const [selected, setSelected] = useState<RoomSetting[]>([]);
  const schema = {
    ...generateDefaultSchema("mc"),
    resources: rooms.map((r) => ({
      roomId: r.roomId,
      name: r.name,
      capacity: Number(r.capacity),
      calendarId: r.calendarId,
      isEquipment: false,
      isWalkIn: false,
      isWalkInCanBookTwo: false,
      services: [],
    })),
    calendarConfig: {
      ...generateDefaultSchema("mc").calendarConfig,
      multipleResourceSelect,
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
        } as any}
      >
        <SelectRooms
          allRooms={rooms}
          formContext={FormContextLevel.FULL_FORM}
          selected={selected}
          setSelected={setSelected}
        />
      </BookingContext.Provider>
    </SchemaContext.Provider>
  );
}

describe("SelectRooms multipleResourceSelect", () => {
  it("disables selecting a second resource when multipleResourceSelect is false", () => {
    render(<TestHarness multipleResourceSelect={false} />);

    const room202 = screen.getByRole("checkbox", {
      name: "202 Lecture Hall",
    }) as HTMLInputElement;
    const room203 = screen.getByRole("checkbox", {
      name: "203 Seminar Room",
    }) as HTMLInputElement;

    fireEvent.click(room202);

    expect(room202.checked).toBe(true);
    const room203AfterFirstSelection = screen.getByRole("checkbox", {
      name: "203 Seminar Room",
    }) as HTMLInputElement;
    expect(room203AfterFirstSelection.disabled).toBe(true);

    fireEvent.click(room203AfterFirstSelection);
    expect(room203AfterFirstSelection.checked).toBe(false);
  });

  it("allows selecting multiple resources when multipleResourceSelect is true", () => {
    render(<TestHarness multipleResourceSelect={true} />);

    const room202 = screen.getByRole("checkbox", {
      name: "202 Lecture Hall",
    }) as HTMLInputElement;
    const room203 = screen.getByRole("checkbox", {
      name: "203 Seminar Room",
    }) as HTMLInputElement;

    fireEvent.click(room202);
    fireEvent.click(room203);

    expect(room202.checked).toBe(true);
    expect(room203.disabled).toBe(false);
    expect(room203.checked).toBe(true);
  });
});
