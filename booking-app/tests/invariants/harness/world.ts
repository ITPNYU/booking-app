import { FakeFirestore } from "./fakeFirestore";
import { FakeCalendar, FakeGmail } from "./fakeGoogle";

/** Shared in-memory state behind every mocked boundary. */
export const world = {
  db: new FakeFirestore(),
  calendar: new FakeCalendar(),
  gmail: new FakeGmail(),
  /** Who the session says is acting. */
  user: { email: "admin@nyu.edu", netId: "admin" } as {
    email: string;
    netId: string;
  } | null,
  /** Every request the application made to its own API, in order. */
  requests: [] as {
    method: string;
    path: string;
    body: unknown;
    status: number;
  }[],
  /** Emails the application asked /api/sendEmail to send. */
  emails: [] as Record<string, unknown>[],
  reset() {
    this.db.reset();
    this.calendar.reset();
    this.gmail.reset();
    this.user = { email: "admin@nyu.edu", netId: "admin" };
    this.requests = [];
    this.emails = [];
  },
};

export const APP_ORIGIN = "http://app.test";
