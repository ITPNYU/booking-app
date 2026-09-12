import fs from "fs";
import Handlebars from "handlebars";
import path from "path";
import { describe, expect, it } from "vitest";

const templateSource = fs.readFileSync(
  path.join(process.cwd(), "app/templates/booking_detail.html"),
  "utf8",
);

Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("formatDate", () => "");

const template = Handlebars.compile(templateSource);

const baseContents = {
  headerMessage: "",
  requestNumber: "42",
  roomId: "202, 103",
  startDate: "Jan 15, 2024",
  startTime: "10:00 AM",
  endTime: "12:00 PM",
  status: "REQUESTED",
  tenant: "mc",
};

describe("booking_detail email services", () => {
  it("renders booking-level rows then a heading and table per room", () => {
    const html = template({
      contents: {
        ...baseContents,
        services: {
          show: true,
          bookingLevel: [
            { label: "Room Setup", value: "Standard" },
          ],
          rooms: [
            {
              title: "202 Screening Room",
              rows: [
                {
                  label: "Catering",
                  value: "Yes",
                  chartField: "123-456",
                },
              ],
            },
            {
              title: "103 The Garage",
              rows: [{ label: "Campus Safety", value: "Willoughby Street Entrance" }],
            },
          ],
        },
      },
      bookingLogs: [],
    });

    expect(html).toContain(">Services<");
    expect(html).toContain("Room Setup");
    expect(html).toContain("Standard");
    expect(html).toContain("202 Screening Room");
    expect(html).toContain("Catering");
    expect(html).toContain("123-456");
    expect(html).toContain("103 The Garage");
    expect(html).toContain("Campus Safety");
    expect(html).not.toContain("Equipment Service");
  });

  it("omits the Services section when nothing was requested", () => {
    const html = template({
      contents: {
        ...baseContents,
        services: { show: false, bookingLevel: [], rooms: [] },
      },
      bookingLogs: [],
    });

    expect(html).not.toContain(">Services<");
  });

  it("renders annex rows for ITP when the email payload includes them", () => {
    const html = template({
      contents: {
        ...baseContents,
        tenant: "itp",
        services: {
          show: true,
          bookingLevel: [],
          rooms: [
            {
              title: "371",
              rows: [
                {
                  label: "Auxiliary Spaces",
                  value: "371A Breakout",
                },
              ],
            },
          ],
        },
      },
      bookingLogs: [],
    });

    expect(html).toContain(">Services<");
    expect(html).toContain("371");
    expect(html).toContain("Auxiliary Spaces");
    expect(html).toContain("371A Breakout");
  });

  it("omits the Services section when the ITP payload has nothing to show", () => {
    const html = template({
      contents: {
        ...baseContents,
        tenant: "itp",
        services: { show: false, bookingLevel: [], rooms: [] },
      },
      bookingLogs: [],
    });

    expect(html).not.toContain(">Services<");
  });

  it("shows auxiliary spaces only under the room in Services, not in Request", () => {
    const html = template({
      contents: {
        ...baseContents,
        auxiliarySpaces: "103: 202GR Garage Green Room",
        services: {
          show: true,
          bookingLevel: [],
          rooms: [
            {
              title: "103 The Garage",
              rows: [
                {
                  label: "Auxiliary Spaces",
                  value: "202GR Garage Green Room",
                },
              ],
            },
          ],
        },
      },
      bookingLogs: [],
    });

    expect(html).toContain("202GR Garage Green Room");
    expect(html).not.toContain("103: 202GR Garage Green Room");
  });
});
