import { renderHook } from "@testing-library/react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useParams: vi.fn(() => ({ tenant: "mc" })),
  usePathname: vi.fn(() => "/mc/booking"),
}));

// Mock BookingContext with no rooms selected and no calendar info
vi.mock(
  "@/components/src/client/routes/booking/bookingProvider",
  () => ({
    BookingContext: {
      _currentValue: {
        bookingCalendarInfo: null,
        selectedRooms: [],
        formData: null,
        role: undefined,
      },
      Provider: ({ children }: any) => children,
    },
  }),
);

// Mock SchemaProvider
vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({
  useTenantSchema: vi.fn(() => ({
    tenant: "mc",
    resources: [],
  })),
}));

// Mock XState to prevent actual machine execution
vi.mock("xstate", () => ({
  createActor: vi.fn(() => ({
    start: vi.fn(),
    getSnapshot: vi.fn(() => ({
      value: "Requested",
      context: { tenant: "mc", selectedRooms: [] },
    })),
    stop: vi.fn(),
  })),
}));

vi.mock("@/lib/stateMachines/itpBookingMachine", () => ({
  itpBookingMachine: {},
}));

vi.mock("@/lib/stateMachines/mcBookingMachine", () => ({
  mcBookingMachine: {},
}));

import useCheckAutoApproval from "@/components/src/client/routes/booking/hooks/useCheckAutoApproval";

describe("useCheckAutoApproval – initial state", () => {
  it("should default isAutoApproval to false before eligibility is determined", () => {
    const { result } = renderHook(() => useCheckAutoApproval());
    // The initial render should NOT show auto-approval banner.
    // XState mock returns "Requested" (not "Approved"), so after effect
    // runs it should still be false.
    expect(result.current.isAutoApproval).toBe(false);
  });
});
