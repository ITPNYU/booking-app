/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import useSortBookingHistory from "@/components/src/client/routes/hooks/useSortBookingHistory";
import { BookingStatusLabel } from "@/components/src/types";
import { renderHook, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Firestore client fetch
vi.mock("@/lib/firebase/firebase", () => ({
  clientFetchAllDataFromCollection: vi.fn(),
}));

// Mock where from firebase/firestore to avoid errors in hook
vi.mock("firebase/firestore", async () => {
  const actual: any = await vi.importActual("firebase/firestore");
  return {
    ...actual,
    where: vi.fn(),
  };
});

// eslint-disable-next-line import/first
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";

const mockFetch = clientFetchAllDataFromCollection as unknown as vi.Mock;

describe("useSortBookingHistory - automatic approval history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const requestNumber = 999;

  it("returns rows that include 'System' when booking logs have auto-approval entries", async () => {
    const logs = [
      {
        id: "log1",
        status: BookingStatusLabel.REQUESTED,
        changedBy: "user@nyu.edu",
        changedAt: Timestamp.now(),
        requestNumber,
      },
      {
        id: "log2",
        status: BookingStatusLabel.APPROVED,
        changedBy: "System",
        changedAt: Timestamp.now(),
        requestNumber,
      },
    ];

    mockFetch.mockResolvedValueOnce(logs);

    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });

    const users = result.current.map(
      (row) => row.props.children[1].props.children
    );
    expect(users).toContain("System");
  });

  it("falls back to booking fields and includes 'System' when finalApprovedBy is System", async () => {
    mockFetch.mockResolvedValueOnce([]); // no logs

    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
      finalApprovedBy: "System",
      finalApprovedAt: Timestamp.now(),
      requestedAt: Timestamp.now(),
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });

    const users = result.current.map(
      (row) => row.props.children[1].props.children
    );
    expect(users).toContain("System");
  });

  it("includes all status rows when logs provide every status", async () => {
    const statuses = [
      BookingStatusLabel.REQUESTED,
      BookingStatusLabel.PENDING,
      BookingStatusLabel.APPROVED,
      BookingStatusLabel.MODIFIED,
      BookingStatusLabel.CANCELED,
      BookingStatusLabel.CHECKED_IN,
      BookingStatusLabel.CHECKED_OUT,
      BookingStatusLabel.NO_SHOW,
      BookingStatusLabel.DECLINED,
    ];

    const logs = statuses.map((status, idx) => ({
      id: `log-${idx}`,
      status,
      changedBy:
        status === BookingStatusLabel.REQUESTED ? "user@nyu.edu" : "System",
      changedAt: Timestamp.fromMillis(idx),
      requestNumber,
    }));

    mockFetch.mockResolvedValueOnce(logs);

    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBe(statuses.length);
    });

    const labels = result.current.map((row) => {
      const cell = Array.isArray(row.props.children)
        ? row.props.children[0]
        : row.props.children;
      return cell.props.children.props.status;
    });

    expect(labels).toEqual(statuses);
  });

  it("records correct user email for each status", async () => {
    const userEmail = "requester@nyu.edu";
    const approver1 = "liaison@nyu.edu";
    const approver2 = "final@nyu.edu";
    const modifier = "editor@nyu.edu";
    const checker = "pa@nyu.edu";
    const decliner = "decline@nyu.edu";
    const noshower = "pa@nyu.edu";
    const checkoutUser = "pa@nyu.edu";

    const statusUserPairs: [BookingStatusLabel, string][] = [
      [BookingStatusLabel.REQUESTED, userEmail],
      [BookingStatusLabel.PENDING, approver1],
      [BookingStatusLabel.APPROVED, approver2],
      [BookingStatusLabel.MODIFIED, modifier],
      [BookingStatusLabel.CHECKED_IN, checker],
      [BookingStatusLabel.CHECKED_OUT, checkoutUser],
      [BookingStatusLabel.NO_SHOW, noshower],
      [BookingStatusLabel.DECLINED, decliner],
    ];

    const logs = statusUserPairs.map(([status, email], idx) => ({
      id: `log-${idx}`,
      status,
      changedBy: email,
      changedAt: Timestamp.fromMillis(idx),
      requestNumber,
    }));

    mockFetch.mockResolvedValueOnce(logs);

    const bookingRow: any = {
      requestNumber,
      email: userEmail,
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBe(statusUserPairs.length);
    });

    const users = result.current.map(
      (row) => row.props.children[1].props.children
    );
    const expectedUsers = statusUserPairs.map((pair) => pair[1]);

    expect(users).toEqual(expectedUsers);
  });

  it("displays decline reason note when booking has been declined with logs", async () => {
    const declineReason = "Room is not available for requested time";
    const logs = [
      {
        id: "log1",
        status: BookingStatusLabel.REQUESTED,
        changedBy: "user@nyu.edu",
        changedAt: Timestamp.now(),
        requestNumber,
      },
      {
        id: "log2",
        status: BookingStatusLabel.DECLINED,
        changedBy: "admin@nyu.edu",
        changedAt: Timestamp.now(),
        requestNumber,
        note: declineReason,
      },
    ];

    mockFetch.mockResolvedValueOnce(logs);

    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBe(2);
    });

    // Get the note from the declined status row (should be second row, index 1)
    const declinedRow = result.current[1];
    const noteCell = declinedRow.props.children[3]; // Fourth column is the note
    const note = noteCell.props.children;

    expect(note).toBe(declineReason);
  });

  it("displays decline reason note in fallback mode when booking has declineReason", async () => {
    mockFetch.mockResolvedValueOnce([]); // no logs, use fallback

    const declineReason = "Event does not meet booking requirements";
    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
      requestedAt: Timestamp.fromMillis(1000),
      declinedAt: Timestamp.fromMillis(2000),
      declinedBy: "admin@nyu.edu",
      declineReason,
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBe(2); // REQUESTED and DECLINED
    });

    // Find the declined row by checking status
    const declinedRow = result.current.find((row) => {
      const statusCell = row.props.children[0];
      const status = statusCell.props.children.props.status;
      return status === BookingStatusLabel.DECLINED;
    });

    expect(declinedRow).toBeDefined();
    const noteCell = declinedRow.props.children[3]; // Fourth column is the note
    const note = noteCell.props.children;

    expect(note).toBe(declineReason);
  });

  it("displays no note when booking is declined without a reason", async () => {
    mockFetch.mockResolvedValueOnce([]); // no logs, use fallback

    const bookingRow: any = {
      requestNumber,
      email: "user@nyu.edu",
      requestedAt: Timestamp.fromMillis(1000),
      declinedAt: Timestamp.fromMillis(2000),
      declinedBy: "admin@nyu.edu",
      // no declineReason provided
    };

    const { result } = renderHook(() => useSortBookingHistory(bookingRow));

    await waitFor(() => {
      expect(result.current.length).toBe(2); // REQUESTED and DECLINED
    });

    // Find the declined row
    const declinedRow = result.current.find((row) => {
      const statusCell = row.props.children[0];
      const status = statusCell.props.children.props.status;
      return status === BookingStatusLabel.DECLINED;
    });

    expect(declinedRow).toBeDefined();
    const noteCell = declinedRow.props.children[3]; // Fourth column is the note
    const note = noteCell.props.children;

    // Note should be undefined when no declineReason is provided
    expect(note).toBeUndefined();
  });
});
