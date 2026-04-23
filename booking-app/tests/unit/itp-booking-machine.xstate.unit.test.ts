import { createActor, type AnyActorRef } from "xstate";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { Role } from "@/components/src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calendar info producing a booking of `hours` duration */
const makeCalendarInfo = (hours = 1) => {
  const start = new Date("2026-03-12T10:00:00Z");
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return { startStr: start.toISOString(), endStr: end.toISOString() };
};

/** Room with auto-approval enabled (hour limits per role, all service conditions false by default) */
const makeAutoApprovalRoom = (
  overrides: {
    minHour?: { admin: number; faculty: number; student: number };
    maxHour?: { admin: number; faculty: number; student: number };
    conditions?: Partial<Record<"setup" | "equipment" | "staffing" | "catering" | "cleaning" | "security", boolean>>;
  } = {},
) => ({
  roomId: 100,
  name: "ITP Room",
  capacity: "20",
  calendarId: "cal-itp",
  autoApproval: {
    minHour: overrides.minHour ?? { admin: -1, faculty: -1, student: -1 },
    maxHour: overrides.maxHour ?? { admin: -1, faculty: -1, student: -1 },
    conditions: {
      setup: false,
      equipment: false,
      staffing: false,
      catering: false,
      cleaning: false,
      security: false,
      ...overrides.conditions,
    },
  },
});

/** Room WITHOUT auto-approval → guard always fails for this room */
const makeManualRoom = () => ({
  roomId: 200,
  name: "Manual Room",
  capacity: "10",
  calendarId: "cal-manual",
});

// Action spy names
const ACTION_NAMES = [
  "createCalendarEvent",
  "sendHTMLEmail",
  "updateCalendarEvent",
  "deleteCalendarEvent",
] as const;

type ActionSpies = Record<(typeof ACTION_NAMES)[number], ReturnType<typeof vi.fn>>;

/** Create a machine with all named actions replaced by spies */
function createSpiedMachine() {
  const spies: ActionSpies = {
    createCalendarEvent: vi.fn(),
    sendHTMLEmail: vi.fn(),
    updateCalendarEvent: vi.fn(),
    deleteCalendarEvent: vi.fn(),
  };

  const machine = itpBookingMachine.provide({
    actions: {
      createCalendarEvent: spies.createCalendarEvent,
      sendHTMLEmail: spies.sendHTMLEmail,
      updateCalendarEvent: spies.updateCalendarEvent,
      deleteCalendarEvent: spies.deleteCalendarEvent,
    },
  });

  return { machine, spies };
}

/** Shorthand: get current state value string from actor */
function stateOf(actor: AnyActorRef): string {
  const value = actor.getSnapshot().value;
  return typeof value === "string" ? value : JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Suppress console.log from inline entry actions (the anonymous ones that log state transitions)
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ===== 1. Initial State =====
describe("Initial State", () => {
  it("stays in Requested when auto-approval guard fails (manual room)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("jumps to Approved when auto-approval guard passes", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });
});

// ===== 2. Manual Approval Happy Path =====
describe("Manual Approval Happy Path", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
    calendarEventId: "evt-1",
    email: "student@nyu.edu",
  };

  it("approve → Approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("approve → checkIn → Checked In", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.stop();
  });

  it("approve → checkIn → checkOut → Closed (auto-close)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("full lifecycle reaches final state", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    actor.send({ type: "checkOut" });
    expect(actor.getSnapshot().status).toBe("done");
    actor.stop();
  });
});

// ===== 3. Auto-Approval Guard =====
describe("Auto-Approval Guard", () => {
  it("Student 1h → auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom({ maxHour: { admin: 4, faculty: 3, student: 1 } })],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("Faculty 3h → auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom({ maxHour: { admin: 4, faculty: 3, student: 1 } })],
        bookingCalendarInfo: makeCalendarInfo(3),
        role: Role.FACULTY,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("Student 2h (exceeds max 1h) → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom({ maxHour: { admin: 4, faculty: 3, student: 1 } })],
        bookingCalendarInfo: makeCalendarInfo(2),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Student 0.25h (below min 0.5h) → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [
          makeAutoApprovalRoom({
            minHour: { admin: 0.5, faculty: 0.5, student: 0.5 },
            maxHour: { admin: 4, faculty: 3, student: 1 },
          }),
        ],
        bookingCalendarInfo: makeCalendarInfo(0.25),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Non-ITP tenant → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "mc",
        selectedRooms: [makeAutoApprovalRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Walk-in → always auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
        isWalkIn: true,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("No rooms → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Room without autoApproval → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Duration at maxHour boundary → auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom({ maxHour: { admin: 4, faculty: 3, student: 2 } })],
        bookingCalendarInfo: makeCalendarInfo(2),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("Duration at minHour boundary → auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [
          makeAutoApprovalRoom({
            minHour: { admin: 0.5, faculty: 0.5, student: 0.5 },
          }),
        ],
        bookingCalendarInfo: makeCalendarInfo(0.5),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("Service requested (catering) without condition → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom()], // catering condition = false
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
        formData: { catering: "yes" },
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Admin 4h → auto-approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeAutoApprovalRoom({ maxHour: { admin: 4, faculty: 3, student: 1 } })],
        bookingCalendarInfo: makeCalendarInfo(4),
        role: Role.ADMIN_STAFF,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });
});

// ===== 4. Cancellation =====
describe("Cancellation", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
  };

  it("Cancel from Requested → Closed", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "cancel" });
    // Canceled is transient → Closed
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("Cancel from Approved → Closed", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "cancel" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("Canceled is transient (always → Closed)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "cancel" });
    // Should never settle in Canceled
    expect(actor.getSnapshot().matches("Canceled")).toBe(false);
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("Canceled entry queues cancelProcessing side effect (user cancel)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "cancel" });
    expect(
      actor.getSnapshot().context.pendingSideEffects,
    ).toContain("cancelProcessing");
    actor.stop();
  });

  it("noShow → Canceled via always also queues cancelProcessing (#1367 structural fix)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "noShow" });
    // noShow → No Show → (always) → Canceled → (always) → Closed
    // Canceled entry must still fire and queue cancelProcessing
    expect(
      actor.getSnapshot().context.pendingSideEffects,
    ).toContain("cancelProcessing");
    actor.stop();
  });

});

// ===== 5. Decline =====
describe("Decline", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
  };

  it("Decline → Declined", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "decline" });
    expect(stateOf(actor)).toBe("Declined");
    actor.stop();
  });

  it("Decline + edit → Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "decline" });
    actor.send({ type: "edit" });
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Decline + edit + approve → Approved", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "decline" });
    actor.send({ type: "edit" });
    actor.send({ type: "approve" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("Decline + 24h timeout → Closed", () => {
    vi.useFakeTimers();
    try {
      const { machine } = createSpiedMachine();
      const actor = createActor(machine, { input: manualInput });
      actor.start();
      actor.send({ type: "decline" });
      expect(stateOf(actor)).toBe("Declined");

      vi.advanceTimersByTime(86_400_000); // 24 hours
      expect(stateOf(actor)).toBe("Closed");
      actor.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Decline + edit before timeout → Requested (timer cancelled)", () => {
    vi.useFakeTimers();
    try {
      const { machine } = createSpiedMachine();
      const actor = createActor(machine, { input: manualInput });
      actor.start();
      actor.send({ type: "decline" });

      // Edit before the 24h timeout
      vi.advanceTimersByTime(10_000); // 10 seconds
      actor.send({ type: "edit" });
      expect(stateOf(actor)).toBe("Requested");

      // Advance past the original timeout — should still be Requested
      vi.advanceTimersByTime(86_400_000);
      expect(stateOf(actor)).toBe("Requested");
      actor.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ===== 6. No Show =====
describe("No Show", () => {
  it("No show from Approved → Closed (via transient No Show → Canceled → Closed)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "noShow" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("cancelProcessing is queued during No Show → Canceled transition (#1367)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "noShow" });
    // Canceled entry queues cancelProcessing; the xstate-transition route
    // executor then fetches /api/cancel-processing which deletes the calendar
    // event. This closes #1367 structurally — every path that traverses
    // Canceled (user cancel, noShow, decline-24h, auto-cancel-unapproved)
    // triggers the same side effect.
    expect(
      actor.getSnapshot().context.pendingSideEffects,
    ).toContain("cancelProcessing");
    actor.stop();
  });
});

// ===== 7. Auto Close Script =====
describe("Auto Close Script", () => {
  it("autoCloseScript from Approved → Closed", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "autoCloseScript" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

});

// ===== 8. Edit Self-Loop =====
describe("Edit Self-Loop", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
  };

  it("Edit from Requested → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "edit" });
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("Multiple edits → stays Requested", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "edit" });
    actor.send({ type: "edit" });
    actor.send({ type: "edit" });
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });
});

// ===== 9. Invalid Transitions =====
describe("Invalid Transitions", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
  };

  it("checkIn from Requested is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("checkOut from Requested is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Requested");
    actor.stop();
  });

  it("checkOut from Approved is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("approve from Approved is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "approve" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("edit from Approved is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "edit" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("decline from Approved is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "decline" });
    expect(stateOf(actor)).toBe("Approved");
    actor.stop();
  });

  it("checkIn self-send from Checked In is ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.stop();
  });

  it("events on Closed (final) are ignored", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "cancel" });
    expect(stateOf(actor)).toBe("Closed");
    // All events should be ignored
    actor.send({ type: "approve" });
    actor.send({ type: "edit" });
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });
});

// ===== 10. Entry Actions Verification =====
describe("Entry Actions Verification", () => {
  const manualInput = {
    tenant: "itp",
    selectedRooms: [makeManualRoom()],
    bookingCalendarInfo: makeCalendarInfo(1),
    role: Role.STUDENT,
    calendarEventId: "evt-action-test",
    email: "test@nyu.edu",
  };

  it("Requested: createCalendarEvent + sendHTMLEmail", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    expect(spies.createCalendarEvent).toHaveBeenCalled();
    expect(spies.sendHTMLEmail).toHaveBeenCalled();
    actor.stop();
  });

  it("Approved: sendHTMLEmail + updateCalendarEvent", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();
    actor.send({ type: "approve" });
    expect(spies.sendHTMLEmail).toHaveBeenCalled();
    expect(spies.updateCalendarEvent).toHaveBeenCalled();
    actor.stop();
  });

  it("Canceled: queues cancelProcessing side effect (machine-driven)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "cancel" });
    // Canceled entry runs before transient → Closed and queues the effect.
    // The xstate-transition route executor drains the queue after the
    // transition completes; cancelProcessing → /api/cancel-processing
    // which handles email + calendar delete + Firestore updates.
    expect(
      actor.getSnapshot().context.pendingSideEffects,
    ).toContain("cancelProcessing");
    actor.stop();
  });

  it("Closed: sendHTMLEmail + updateCalendarEvent", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();
    actor.send({ type: "approve" });
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();
    actor.send({ type: "autoCloseScript" });
    expect(spies.sendHTMLEmail).toHaveBeenCalled();
    expect(spies.updateCalendarEvent).toHaveBeenCalled();
    actor.stop();
  });

  it("Checked In: sendHTMLEmail + updateCalendarEvent", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();
    actor.send({ type: "checkIn" });
    expect(spies.sendHTMLEmail).toHaveBeenCalled();
    expect(spies.updateCalendarEvent).toHaveBeenCalled();
    actor.stop();
  });

  it("No Show: updateCalendarEvent only (no sendHTMLEmail)", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();

    // Track calls specifically from No Show entry (before Canceled transient kicks in)
    const updateCallsBefore = spies.updateCalendarEvent.mock.calls.length;
    const emailCallsBefore = spies.sendHTMLEmail.mock.calls.length;
    actor.send({ type: "noShow" });

    // updateCalendarEvent is called in No Show and Closed entries.
    // Canceled entry no longer has sendHTMLEmail/updateCalendarEvent/deleteCalendarEvent —
    // it queues cancelProcessing instead (handled by the xstate-transition
    // route executor, not via the machine action spies).
    const totalUpdateCalls = spies.updateCalendarEvent.mock.calls.length - updateCallsBefore;
    const totalEmailCalls = spies.sendHTMLEmail.mock.calls.length - emailCallsBefore;
    expect(totalUpdateCalls).toBe(2); // No Show(1) + Closed(1)
    expect(totalEmailCalls).toBe(1); // Closed(1); No Show and Canceled have none
    // Canceled side effect is queued instead of fired as a machine action
    expect(
      actor.getSnapshot().context.pendingSideEffects,
    ).toContain("cancelProcessing");
    actor.stop();
  });

  it("Checked Out: sendHTMLEmail + updateCalendarEvent", () => {
    const { machine, spies } = createSpiedMachine();
    const actor = createActor(machine, { input: manualInput });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    spies.sendHTMLEmail.mockClear();
    spies.updateCalendarEvent.mockClear();
    actor.send({ type: "checkOut" });
    // Checked Out entry fires, then transient → Closed entry also fires
    expect(spies.sendHTMLEmail).toHaveBeenCalled();
    expect(spies.updateCalendarEvent).toHaveBeenCalled();
    actor.stop();
  });
});

// ===== 11. Context =====
describe("Context", () => {
  it("Input context preserved through transitions", () => {
    const { machine } = createSpiedMachine();
    const input = {
      tenant: "itp",
      selectedRooms: [makeManualRoom()],
      bookingCalendarInfo: makeCalendarInfo(1),
      role: Role.STUDENT,
      calendarEventId: "evt-ctx",
      email: "ctx@nyu.edu",
    };
    const actor = createActor(machine, { input });
    actor.start();
    actor.send({ type: "approve" });

    const ctx = actor.getSnapshot().context;
    expect(ctx.tenant).toBe("itp");
    expect(ctx.calendarEventId).toBe("evt-ctx");
    expect(ctx.email).toBe("ctx@nyu.edu");
    expect(ctx.role).toBe(Role.STUDENT);
    actor.stop();
  });

  it("Default values (isWalkIn=false, isVip=false) applied", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
      },
    });
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.isWalkIn).toBe(false);
    expect(ctx.isVip).toBe(false);
    actor.stop();
  });
});

// ===== 12. E2E Scenario Flows =====
describe("E2E Scenario Flows", () => {
  it("Full manual: approve → checkIn → checkOut → Closed", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.send({ type: "approve" });
    expect(stateOf(actor)).toBe("Approved");
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Closed");
    expect(actor.getSnapshot().status).toBe("done");
    actor.stop();
  });

  it("Decline-edit cycle: decline → edit → approve → checkIn → checkOut → Closed", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    expect(stateOf(actor)).toBe("Requested");
    actor.send({ type: "decline" });
    expect(stateOf(actor)).toBe("Declined");
    actor.send({ type: "edit" });
    expect(stateOf(actor)).toBe("Requested");
    actor.send({ type: "approve" });
    expect(stateOf(actor)).toBe("Approved");
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Closed");
    actor.stop();
  });

  it("Auto-approved walk-in lifecycle", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
        isWalkIn: true,
      },
    });
    actor.start();
    // Walk-in auto-approved
    expect(stateOf(actor)).toBe("Approved");
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.send({ type: "checkOut" });
    expect(stateOf(actor)).toBe("Closed");
    expect(actor.getSnapshot().status).toBe("done");
    actor.stop();
  });

  it("Cancel from Checked In is invalid (stays Checked In)", () => {
    const { machine } = createSpiedMachine();
    const actor = createActor(machine, {
      input: {
        tenant: "itp",
        selectedRooms: [makeManualRoom()],
        bookingCalendarInfo: makeCalendarInfo(1),
        role: Role.STUDENT,
      },
    });
    actor.start();
    actor.send({ type: "approve" });
    actor.send({ type: "checkIn" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.send({ type: "cancel" });
    expect(stateOf(actor)).toBe("Checked In");
    actor.stop();
  });
});
