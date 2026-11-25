import { createActor, type AnyActor } from "xstate";
import { describe, expect, it } from "vitest";
import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { compileApprovalFlow } from "@/lib/stateMachines/approvalFlowMachine";
import { itpApprovalFlow } from "@/lib/stateMachines/flows/itpApprovalFlow";
import { mcApprovalFlow } from "@/lib/stateMachines/flows/mcApprovalFlow";

const hour = 60 * 60 * 1000;

function calendar() {
  const start = new Date("2026-06-01T15:00:00.000Z");
  return {
    startStr: start.toISOString(),
    endStr: new Date(start.getTime() + hour).toISOString(),
  };
}

const autoRoom = {
  roomId: 202,
  autoApproval: {
    shouldAutoApprove: true,
    minHour: { admin: -1, faculty: -1, student: -1 },
    maxHour: { admin: -1, faculty: -1, student: -1 },
    conditions: {
      setup: false,
      equipment: false,
      staffing: false,
      catering: false,
      cleaning: false,
      security: false,
    },
  },
};

function valueOf(machine: AnyActor["logic"], input: Record<string, unknown>, events: { type: string }[] = []) {
  const actor = createActor(machine as never, { input });
  actor.start();
  for (const event of events) actor.send(event);
  const value = actor.getSnapshot().value;
  actor.stop();
  return value;
}

describe("approval flow parity", () => {
  const mcCompiled = compileApprovalFlow(mcApprovalFlow);
  const itpCompiled = compileApprovalFlow(itpApprovalFlow);

  it("keeps the machine ids stored on booking snapshots", () => {
    expect(mcCompiled.id).toBe(mcBookingMachine.id);
    expect(itpCompiled.id).toBe(itpBookingMachine.id);
    expect(mcCompiled.config.states?.Declined).toBeTruthy();
    const declined = itpCompiled.config.states?.Declined as {
      after?: Record<string, { target?: string }>;
    };
    expect(declined.after?.["86400000"]?.target).toBe("Canceled");
  });

  it("matches Media Commons approval paths", () => {
    const cases: { input: Record<string, unknown>; events?: { type: string }[] }[] = [
      {
        input: {
          tenant: "mc",
          selectedRooms: [autoRoom],
          bookingCalendarInfo: calendar(),
          role: "faculty",
        },
      },
      {
        input: {
          tenant: "mc",
          isVip: true,
          servicesRequested: { staff: true },
          selectedRooms: [{ roomId: 202 }],
          bookingCalendarInfo: calendar(),
        },
      },
      {
        input: {
          tenant: "mc",
          servicesRequested: { staff: true },
          servicesApproved: {},
          selectedRooms: [{ roomId: 202 }],
          bookingCalendarInfo: calendar(),
        },
        events: [{ type: "approve" }, { type: "approve" }, { type: "declineStaff" }],
      },
      {
        input: {
          tenant: "mc",
          servicesRequested: { staff: true },
          selectedRooms: [autoRoom],
          bookingCalendarInfo: calendar(),
          role: "faculty",
        },
        events: [{ type: "cancel" }],
      },
    ];

    for (const { input, events } of cases) {
      expect(valueOf(mcCompiled, input, events)).toEqual(
        valueOf(mcBookingMachine, input, events),
      );
    }
  });

  it("matches ITP approval paths", () => {
    const manual = {
      tenant: "itp",
      selectedRooms: [{ roomId: 1 }],
      bookingCalendarInfo: calendar(),
      role: "faculty",
    };
    const auto = {
      ...manual,
      selectedRooms: [autoRoom],
    };

    expect(valueOf(itpCompiled, auto)).toEqual(valueOf(itpBookingMachine, auto));
    expect(
      valueOf(itpCompiled, manual, [{ type: "decline" }]),
    ).toEqual(valueOf(itpBookingMachine, manual, [{ type: "decline" }]));
    expect(
      valueOf(itpCompiled, manual, [
        { type: "approve" },
        { type: "checkIn" },
        { type: "checkOut" },
      ]),
    ).toEqual(
      valueOf(itpBookingMachine, manual, [
        { type: "approve" },
        { type: "checkIn" },
        { type: "checkOut" },
      ]),
    );
    expect(
      valueOf(itpCompiled, manual, [{ type: "approve" }, { type: "noShow" }]),
    ).toEqual(
      valueOf(itpBookingMachine, manual, [{ type: "approve" }, { type: "noShow" }]),
    );
  });

  it("keeps Media Commons hour limits and restore behavior on the legacy machine", () => {
    const start = new Date("2026-06-01T15:00:00.000Z");
    const twoHours = {
      startStr: start.toISOString(),
      endStr: new Date(start.getTime() + 2 * hour).toISOString(),
    };
    const limitedRoom = {
      roomId: 202,
      autoApproval: {
        shouldAutoApprove: true,
        minHour: { admin: -1, faculty: -1, student: -1 },
        maxHour: { admin: 8, faculty: 8, student: 1 },
        conditions: autoRoom.autoApproval.conditions,
      },
    };
    const facultyOverStudentLimit = {
      tenant: "mc",
      role: "faculty",
      selectedRooms: [limitedRoom],
      bookingCalendarInfo: twoHours,
    };

    expect(valueOf(mcCompiled, facultyOverStudentLimit)).toBe("Requested");
    expect(valueOf(mcCompiled, facultyOverStudentLimit)).toEqual(
      valueOf(mcBookingMachine, facultyOverStudentLimit),
    );

    const restored = {
      tenant: "mc",
      selectedRooms: [autoRoom],
      bookingCalendarInfo: calendar(),
      role: "faculty",
      _restoredFromStatus: true,
      declineReason: "old",
      automationReason: "decline",
      pendingSideEffects: ["sendHTMLEmail"],
    };
    expect(valueOf(mcCompiled, restored)).toEqual(
      valueOf(mcBookingMachine, restored),
    );
  });

  it("still uses the passed role for ITP hour limits", () => {
    const start = new Date("2026-06-01T15:00:00.000Z");
    const input = {
      tenant: "itp",
      role: "faculty",
      selectedRooms: [
        {
          roomId: 1,
          autoApproval: {
            shouldAutoApprove: true,
            minHour: { admin: -1, faculty: -1, student: -1 },
            maxHour: { admin: 8, faculty: 8, student: 1 },
            conditions: autoRoom.autoApproval.conditions,
          },
        },
      ],
      bookingCalendarInfo: {
        startStr: start.toISOString(),
        endStr: new Date(start.getTime() + 2 * hour).toISOString(),
      },
    };

    expect(valueOf(itpCompiled, input)).toBe("Approved");
    expect(valueOf(itpCompiled, input)).toEqual(valueOf(itpBookingMachine, input));
  });
});
