import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Environment variables
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

const mockServerSendBookingDetailEmail = vi.fn();

vi.mock("@/components/src/server/admin", () => ({
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
}));

function makeSnapshot(value: string | object, context: any = {}) {
  return { value, context };
}

describe("xstateEffects", () => {
  const calendarEventId = "test-event-123";
  const email = "admin@nyu.edu";
  const tenant = "mc";

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
  });

  describe("handleStateTransitions", () => {
    let handleStateTransitions: any;

    beforeEach(async () => {
      const mod = await import(
        "@/lib/stateMachines/xstateEffects"
      );
      handleStateTransitions = mod.handleStateTransitions;
    });

    it("should skip when no state change", async () => {
      const firestoreUpdates: any = {};
      await handleStateTransitions(
        makeSnapshot("Requested"),
        makeSnapshot("Requested"),
        calendarEventId,
        email,
        tenant,
        firestoreUpdates,
      );

      // No external calls should be made
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
    });

    it("should not set any timestamps (handled by processing routes)", async () => {
      for (const [from, to] of [
        ["Pre-approved", "Approved"],
        ["Requested", "Declined"],
        ["Approved", "No Show"],
        ["Approved", "Canceled"],
        ["Approved", "Checked In"],
        ["Requested", "Pre-approved"],
      ]) {
        const updates: any = {};
        await handleStateTransitions(
          makeSnapshot(from),
          makeSnapshot(to),
          calendarEventId,
          email,
          tenant,
          updates,
        );

        expect(updates.finalApprovedAt).toBeUndefined();
        expect(updates.declinedAt).toBeUndefined();
        expect(updates.noShowedAt).toBeUndefined();
        expect(updates.canceledAt).toBeUndefined();
        expect(updates.checkedInAt).toBeUndefined();
        expect(updates.firstApprovedAt).toBeUndefined();
      }
    });

    it("should not send emails or update calendars (handled by processing routes)", async () => {
      await handleStateTransitions(
        makeSnapshot("Requested"),
        makeSnapshot("Declined"),
        calendarEventId,
        email,
        tenant,
        {},
      );

      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not trigger side effects for Service Closeout", async () => {
      const serviceCloseoutState = { "Service Closeout": "some-state" };
      const firestoreUpdates: any = {};
      await handleStateTransitions(
        makeSnapshot("Checked In"),
        makeSnapshot(serviceCloseoutState),
        calendarEventId,
        email,
        tenant,
        firestoreUpdates,
      );

      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not trigger side effects for Services Request", async () => {
      const servicesRequestState = { "Services Request": "some-state" };
      const firestoreUpdates: any = {};
      await handleStateTransitions(
        makeSnapshot("Requested"),
        makeSnapshot(servicesRequestState),
        calendarEventId,
        email,
        tenant,
        firestoreUpdates,
      );

      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
