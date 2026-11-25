import { Timestamp } from "firebase-admin/firestore";
import { createActor } from "xstate";
import { world } from "./world";

export type SeedOptions = {
  tenant: "mc" | "itp";
  /** A room of the test tenant schema (lib/utils/testTenantSchema.ts). */
  roomId: string;
  calendarId: string;
  /** Extra booking fields, e.g. service requests. */
  fields?: Record<string, unknown>;
};

let counter = 0;

const HOUR = 60 * 60 * 1000;

/**
 * Put a freshly submitted booking into the fake world the way
 * POST /api/bookings leaves it: a booking document whose machine snapshot
 * comes from the real machine, and a [REQUESTED] calendar event.
 */
export async function seedRequestedBooking(options: SeedOptions) {
  const { tenant, roomId, calendarId, fields = {} } = options;
  counter += 1;
  const calendarEventId = `event-${counter}`;
  const start = new Date(Date.now() + 24 * HOUR);
  const end = new Date(start.getTime() + 2 * HOUR);

  const { getTestTenantSchema } = await import("@/lib/utils/testTenantSchema");
  world.db.seed(
    "tenantSchema",
    tenant,
    getTestTenantSchema(tenant) as unknown as Record<string, unknown>,
  );

  const booking: Record<string, unknown> = {
    calendarEventId,
    requestNumber: 1000 + counter,
    email: "guest@nyu.edu",
    netId: "guest",
    firstName: "Guest",
    lastName: "User",
    role: "Student",
    department: "ITP",
    title: "Invariant test booking",
    description: "",
    roomId,
    startDate: Timestamp.fromDate(start),
    endDate: Timestamp.fromDate(end),
    requestedAt: Timestamp.now(),
    origin: "user",
    ...fields,
  };

  const { getMachineForTenant } =
    await import("@/lib/stateMachines/xstatePersistence");
  const { getMediaCommonsServices } =
    await import("@/components/src/utils/tenantUtils");
  const { serverGetTenantResources } =
    await import("@/lib/tenant/serverGetTenantResources");
  const resources = await serverGetTenantResources(tenant);
  const selectedRooms = resources.filter(
    (room: { roomId?: unknown; resourceId?: unknown }) =>
      String(room.roomId ?? room.resourceId) === roomId,
  );
  const machine = getMachineForTenant(tenant);
  const actor = createActor(machine as never, {
    input: {
      tenant,
      selectedRooms,
      formData: booking,
      bookingCalendarInfo: {
        startStr: start.toISOString(),
        endStr: end.toISOString(),
      },
      isWalkIn: false,
      email: booking.email,
      calendarEventId,
      servicesRequested:
        tenant === "mc"
          ? getMediaCommonsServices(booking as never, resources as never)
          : undefined,
      isVip: false,
      role: booking.role,
    } as never,
  });
  actor.start();
  const snapshot = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  actor.stop();

  const docId = `booking-${counter}`;
  world.db.seed(`${tenant}-bookings`, docId, {
    ...booking,
    xstateData: {
      machineId: machine.id,
      lastTransition: new Date().toISOString(),
      snapshot,
    },
  });
  world.calendar.seed(calendarId, {
    id: calendarEventId,
    summary: `[REQUESTED] ${booking.title}`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  });

  return {
    tenant,
    docId,
    calendarEventId,
    calendarId,
    initialState: snapshot.value,
  };
}
