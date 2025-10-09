import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { createActor } from 'xstate';
import type { ActorRefFrom } from 'xstate';

import { mcBookingMachine } from '@/lib/stateMachines/mcBookingMachine';

const makeCalendarInfo = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    startStr: start.toISOString(),
    endStr: end.toISOString(),
  };
};

const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();

vi.mock('@/lib/firebase/server/adminDb', () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverSaveDataToFirestore: mockServerSaveDataToFirestore,
}));

vi.mock('@/components/src/policy', () => ({
  TableNames: {
    BOOKING: 'bookings',
    BOOKING_LOGS: 'bookingLogs',
  },
}));

vi.mock('@/components/src/types', () => ({
  BookingStatusLabel: {
    REQUESTED: 'REQUESTED',
    PRE_APPROVED: 'PRE-APPROVED',
    APPROVED: 'APPROVED',
    DECLINED: 'DECLINED',
    CANCELED: 'CANCELED',
    NO_SHOW: 'NO-SHOW',
  },
}));

type BookingActor = ActorRefFrom<typeof mcBookingMachine['createActor']>;

const mockFetch = vi.fn();

const createTestActor = (input: Partial<Parameters<typeof mcBookingMachine['createActor']>[0]['input']> = {}): BookingActor => {
  const actor = createActor(mcBookingMachine, {
    input: {
      tenant: 'mc',
      selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
      bookingCalendarInfo: makeCalendarInfo(),
      calendarEventId: 'cal-123',
      ...input,
    },
  });
  actor.start();
  return actor;
};

const waitForCondition = async (
  actor: BookingActor,
  condition: (snapshot: ReturnType<BookingActor['getSnapshot']>) => boolean,
  timeout = 1_000
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const snapshot = actor.getSnapshot();
    if (condition(snapshot)) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for state condition');
};

const waitForMockCall = async (
  mockFn: Mock,
  predicate: (arg: any) => boolean,
  timeout = 1_000
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const matchingCall = mockFn.mock.calls.find(([firstArg]) => predicate(firstArg));
    if (matchingCall) {
      return matchingCall[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for mock call');
};

describe('mcBookingMachine', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      status: 200,
      statusText: 'OK',
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    mockLogServerBookingChange.mockReset();
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockReset();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: 'booking-123',
      requestNumber: 123,
    });
    mockServerUpdateDataByCalendarEventId.mockReset();
    mockServerSaveDataToFirestore.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('auto-approval notifies stakeholders and records booking history', () => {
    const emailsSent: string[] = [];
    const calendarEvents: { title: string }[] = [];
    const loggedStatuses: string[] = [];

    const providedMachine = mcBookingMachine.provide({
      actions: {
        sendHTMLEmail: ({ context }) => {
          const recipients = [
            context.formData?.email ?? context.email,
            context.formData?.sponsorEmail,
            'mediacommons.reservations@nyu.edu',
          ].filter(Boolean) as string[];
          emailsSent.push(...recipients);
        },
        createCalendarEvent: ({ context }) => {
          const title = `[Approved] ${context.formData?.title ?? ''}`.trim();
          calendarEvents.push({ title });
        },
        logBookingHistory: (_args, params: { status?: string }) => {
          if (params?.status) {
            loggedStatuses.push(params.status);
          }
        },
      },
    });

    const actor = createActor(providedMachine, {
      input: {
        tenant: 'mc',
        calendarEventId: 'cal-123',
        email: 'guest@nyu.edu',
        selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
        bookingCalendarInfo: makeCalendarInfo(),
        formData: {
          email: 'guest@nyu.edu',
          sponsorEmail: 'sponsor@nyu.edu',
          title: 'Media Commons Auto Approval',
        },
      },
    });

    actor.start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('Approved')).toBe(true);

    expect(emailsSent).toEqual(
      expect.arrayContaining([
        'guest@nyu.edu',
        'sponsor@nyu.edu',
        'mediacommons.reservations@nyu.edu',
      ])
    );
    expect(calendarEvents[0]?.title).toContain('[Approved]');
    expect(loggedStatuses).toEqual(
      expect.arrayContaining(['REQUESTED', 'APPROVED'])
    );
  });

  it('sends request communications and logs when manual approval is required', async () => {
    const emailsSent: string[] = [];
    const calendarTitles: string[] = [];

    const providedMachine = mcBookingMachine.provide({
      actions: {
        sendHTMLEmail: ({ context }) => {
          const recipients = [
            context.formData?.email ?? context.email,
            ...(context.liaisonUsers?.map((user: { email: string }) => user.email) ?? []),
          ].filter(Boolean) as string[];
          emailsSent.push(...recipients);
        },
        createCalendarEvent: ({ context }) => {
          const title = `[Requested] ${context.formData?.title ?? ''}`.trim();
          calendarTitles.push(title);
        },
      },
    });

    mockLogServerBookingChange.mockClear();

    const actor = createActor(providedMachine, {
      input: {
        tenant: 'mc',
        calendarEventId: 'cal-request-123',
        email: 'requestor@nyu.edu',
        selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
        bookingCalendarInfo: makeCalendarInfo(),
        formData: {
          email: 'requestor@nyu.edu',
          title: 'Manual Approval Needed',
        },
        liaisonUsers: [{ email: 'liaison@nyu.edu' }],
      },
    });

    actor.start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('Requested')).toBe(true);

    expect(emailsSent).toEqual(expect.arrayContaining(['requestor@nyu.edu', 'liaison@nyu.edu']));
    expect(calendarTitles[0]).toContain('[Requested]');

    const requestLog = await waitForMockCall(
      mockLogServerBookingChange,
      (payload) => payload?.status === 'REQUESTED'
    );
    expect(requestLog.changedBy).toBe('requestor@nyu.edu');
  });

  it('auto-approves when rooms allow auto approval and no services are requested', () => {
    const actor = createTestActor();

    expect(actor.getSnapshot().matches('Approved')).toBe(true);
  });

  it('routes VIP bookings with services into the Services Request parallel state', () => {
    const actor = createTestActor({
      isVip: true,
      servicesRequested: { staff: true },
    });

    const snapshot = actor.getSnapshot();

    expect(snapshot.matches('Services Request')).toBe(true);
    expect(snapshot.value).toEqual({
      'Services Request': {
        'Staff Request': 'Staff Requested',
        'Catering Request': 'Catering Approved',
        'Setup Request': 'Setup Approved',
        'Cleaning Request': 'Cleaning Approved',
        'Security Request': 'Security Approved',
        'Equipment Request': 'Equipment Approved',
      },
    });
  });

  it('moves from Pre-approved to Services Request when approvals are pending', () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { equipment: true },
      servicesApproved: {},
    });

    actor.send({ type: 'approve' });
    expect(actor.getSnapshot().matches('Pre-approved')).toBe(true);

    actor.send({ type: 'approve' });
    expect(actor.getSnapshot().matches('Services Request')).toBe(true);
  });

  it('completes approval when all requested services are already approved', () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { staff: true },
      servicesApproved: { staff: true },
    });

    actor.send({ type: 'approve' });
    expect(actor.getSnapshot().matches('Pre-approved')).toBe(true);

    actor.send({ type: 'approve' });
    expect(actor.getSnapshot().matches('Approved')).toBe(true);
  });

  it('defaults decline reason when declining without a provided note', () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
    });

    expect(actor.getSnapshot().matches('Requested')).toBe(true);
    actor.send({ type: 'approve' });
    expect(actor.getSnapshot().matches('Pre-approved')).toBe(true);

    actor.send({ type: 'decline' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('Declined')).toBe(true);
    expect(snapshot.context.declineReason).toBe('Service requirements could not be fulfilled');
  });

  it('cancels without services and transitions to Closed', async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches('Approved')).toBe(true);

    actor.send({ type: 'cancel' });
    await waitForCondition(actor, (snapshot) => snapshot.matches('Closed'));

    expect(mockFetch).toHaveBeenCalled();
  });

  it('cancels with approved services and waits for closeout before closing', async () => {
    const actor = createTestActor({
      isWalkIn: true,
      servicesRequested: { staff: true },
      servicesApproved: { staff: true },
    });

    expect(actor.getSnapshot().matches('Approved')).toBe(true);
    actor.send({ type: 'cancel' });

    await waitForCondition(actor, (snapshot) => snapshot.matches('Service Closeout'));
    actor.send({ type: 'closeoutStaff' });

    await waitForCondition(actor, (snapshot) => snapshot.matches('Closed'));
  });

  it('handles check-in and check-out flow to completion', async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches('Approved')).toBe(true);

    actor.send({ type: 'checkIn' });
    expect(actor.getSnapshot().matches('Checked In')).toBe(true);

    actor.send({ type: 'checkOut' });
    await waitForCondition(actor, (snapshot) => snapshot.matches('Closed'));
  });

  it('marks no show, logs history, and closes the booking', async () => {
    const actor = createTestActor({ isWalkIn: true, email: 'user@nyu.edu' });
    expect(actor.getSnapshot().matches('Approved')).toBe(true);

    actor.send({ type: 'noShow' });

    await waitForCondition(actor, (snapshot) => snapshot.matches('Closed'));

    expect(mockLogServerBookingChange).toHaveBeenCalled();
  });

  it('closes reservations when autoCloseScript event is received', async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches('Approved')).toBe(true);

    actor.send({ type: 'autoCloseScript' });
    await waitForCondition(actor, (snapshot) => snapshot.matches('Closed'));
  });

  it('approves requested services and transitions back to Approved', async () => {
    const actor = createTestActor({
      isVip: true,
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { catering: true },
    });

    expect(actor.getSnapshot().matches('Services Request')).toBe(true);
    actor.send({ type: 'approveCatering' });

    await waitForCondition(actor, (snapshot) => snapshot.matches('Approved'));
  });

  it('declines requested services and moves to Declined state', async () => {
    const actor = createTestActor({
      isVip: true,
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { equipment: true },
    });

    expect(actor.getSnapshot().matches('Services Request')).toBe(true);
    actor.send({ type: 'declineEquipment' });

    await waitForCondition(actor, (snapshot) => snapshot.matches('Declined'));
  });
});
