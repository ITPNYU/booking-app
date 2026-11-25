/**
 * Replaces the application's outside world with in-memory fakes: Firestore,
 * Google Calendar, Gmail, the session, and HTTP calls to its own API (which
 * are served in-process by the real route handlers).
 *
 * Import this file first in a test, before any application module.
 */
import { vi } from "vitest";

process.env.NEXT_PUBLIC_BASE_URL = "http://app.test";

vi.mock("firebase-admin", async () => {
  const real = await vi.importActual<typeof import("firebase-admin/firestore")>(
    "firebase-admin/firestore",
  );
  const { world: w } = await import("./world");
  const firestore = Object.assign(() => w.db, {
    Timestamp: real.Timestamp,
    FieldValue: real.FieldValue,
  });
  const admin = {
    apps: [{}],
    initializeApp: () => ({}),
    credential: { cert: () => ({}) },
    firestore,
  };
  return { ...admin, default: admin };
});

vi.mock("firebase-admin/firestore", async () => {
  const real = await vi.importActual<typeof import("firebase-admin/firestore")>(
    "firebase-admin/firestore",
  );
  const { world: w } = await import("./world");
  return { ...real, getFirestore: () => w.db };
});

vi.mock("@/lib/googleClient", async () => {
  const { world: w } = await import("./world");
  const unsupported = (name: string) => async () => {
    throw new Error(`invariant harness: ${name} is not faked`);
  };
  return {
    getCalendarClient: async () => w.calendar,
    getGmailClient: async () => w.gmail,
    getGoogleSheet: unsupported("getGoogleSheet"),
    getLoggingClient: unsupported("getLoggingClient"),
    getFormsClient: unsupported("getFormsClient"),
    getOAuth2Client: unsupported("getOAuth2Client"),
    oauth2Client: {},
  };
});

vi.mock("@/lib/api/requireSession", async () => {
  const { world: w } = await import("./world");
  return { requireSession: async () => w.user };
});

// Who may approve or decline is covered by its own unit tests. Here every
// caller is allowed, so a refusal can only come from the booking's state.
vi.mock("@/lib/api/bookingDecisionAuthz", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  authorizeBookingDecision: async () => true,
}));
