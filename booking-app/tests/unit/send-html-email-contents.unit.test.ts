import { describe, expect, it } from "vitest";
import { toSendHTMLEmailContents } from "@/app/api/bookings/shared";
import { getBookingServicesByRoom } from "@/components/src/utils/bookingServicesDisplay";

describe("toSendHTMLEmailContents", () => {
  it("keeps *ByRoom maps as objects so per-room services survive email send", () => {
    const cateringByRoom = { "202": "yes" };
    const chartFieldForCateringByRoom = { "202": "123-456" };
    const hireSecurityByRoom = { "103": "willoughby" };

    const contents = toSendHTMLEmailContents({
      title: "Faculty Mixer",
      requestNumber: 42,
      roomId: "202, 103",
      cateringByRoom,
      chartFieldForCateringByRoom,
      hireSecurityByRoom,
      missing: null,
    });

    expect(contents.title).toBe("Faculty Mixer");
    expect(contents.requestNumber).toBe("42");
    expect(contents.cateringByRoom).toBe(cateringByRoom);
    expect(contents.chartFieldForCateringByRoom).toBe(
      chartFieldForCateringByRoom,
    );
    expect(contents.hireSecurityByRoom).toBe(hireSecurityByRoom);

    const display = getBookingServicesByRoom(contents);
    expect(display.rooms.map((room) => room.roomId)).toEqual(["202", "103"]);
    expect(display.rooms[0].rows).toEqual([
      { key: "catering", label: "Catering", value: "Yes", chartField: "123-456" },
    ]);
    expect(display.rooms[1].rows[0]).toMatchObject({
      key: "security",
      value: "Willoughby entrance",
    });
  });

  it("would drop per-room services if maps were stringified", () => {
    const display = getBookingServicesByRoom({
      roomId: "202, 103",
      cateringByRoom: String({ "202": "yes" }) as unknown as Record<
        string,
        string
      >,
      chartFieldForCateringByRoom: String({ "202": "123-456" }) as unknown as Record<
        string,
        string
      >,
    });

    expect(display.rooms).toEqual([]);
    expect(display.bookingLevel).toEqual([]);
  });
});
