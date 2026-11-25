/**
 * In-memory Google Calendar and Gmail. Only the calls the booking server code
 * makes are implemented; anything else throws so a new dependency is noticed.
 */

type CalendarEvent = Record<string, unknown> & { id: string };

const notFound = () =>
  Object.assign(new Error("Not Found"), { code: 404, status: 404 });

export class FakeCalendar {
  /** calendarId -> eventId -> event */
  private calendars = new Map<string, Map<string, CalendarEvent>>();

  private nextId = 1;

  /** Every mutating call, in order. */
  calls: { method: string; calendarId: string; eventId?: string }[] = [];

  reset() {
    this.calendars.clear();
    this.calls = [];
    this.nextId = 1;
  }

  private table(calendarId: string) {
    let table = this.calendars.get(calendarId);
    if (!table) {
      table = new Map();
      this.calendars.set(calendarId, table);
    }
    return table;
  }

  /** Test-side helpers that do not count as application activity. */
  seed(calendarId: string, event: CalendarEvent) {
    this.table(calendarId).set(event.id, structuredClone(event));
  }

  peek(calendarId: string, eventId: string): CalendarEvent | undefined {
    const event = this.table(calendarId).get(eventId);
    return event ? structuredClone(event) : undefined;
  }

  events = {
    get: async ({
      calendarId,
      eventId,
    }: {
      calendarId: string;
      eventId: string;
    }) => {
      const event = this.table(calendarId).get(eventId);
      if (!event) throw notFound();
      return { data: structuredClone(event), status: 200 };
    },
    list: async ({ calendarId }: { calendarId: string }) => ({
      data: {
        items: [...this.table(calendarId).values()].map((e) =>
          structuredClone(e),
        ),
      },
      status: 200,
    }),
    insert: async ({
      calendarId,
      requestBody,
    }: {
      calendarId: string;
      requestBody: Record<string, unknown>;
    }) => {
      const id = (requestBody.id as string) ?? `fake-event-${this.nextId}`;
      this.nextId += 1;
      const event = { ...structuredClone(requestBody), id };
      this.table(calendarId).set(id, event);
      this.calls.push({ method: "insert", calendarId, eventId: id });
      return { data: structuredClone(event), status: 200 };
    },
    patch: async ({
      calendarId,
      eventId,
      requestBody,
    }: {
      calendarId: string;
      eventId: string;
      requestBody: Record<string, unknown>;
    }) => {
      const event = this.table(calendarId).get(eventId);
      if (!event) throw notFound();
      Object.assign(event, structuredClone(requestBody));
      this.calls.push({ method: "patch", calendarId, eventId });
      return { data: structuredClone(event), status: 200 };
    },
    update: async (args: {
      calendarId: string;
      eventId: string;
      requestBody: Record<string, unknown>;
    }) => this.events.patch(args),
    delete: async ({
      calendarId,
      eventId,
    }: {
      calendarId: string;
      eventId: string;
    }) => {
      if (!this.table(calendarId).delete(eventId)) throw notFound();
      this.calls.push({ method: "delete", calendarId, eventId });
      return { data: {}, status: 204 };
    },
  };
}

export class FakeGmail {
  sent: unknown[] = [];

  reset() {
    this.sent = [];
  }

  users = {
    messages: {
      send: async (args: unknown) => {
        this.sent.push(args);
        return {
          data: { id: `fake-message-${this.sent.length}` },
          status: 200,
        };
      },
    },
  };
}
