import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useParams: vi.fn(() => ({ tenant: "mc" })),
  usePathname: vi.fn(() => "/mc/booking"),
}));

// Mock SchemaProvider
vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({
  useTenantSchema: vi.fn(() => ({
    tenant: "mc",
    resources: [],
  })),
}));

// Mock XState - returns "Requested" (not "Approved") to reject auto-approval
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

import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import useCheckAutoApproval from "@/components/src/client/routes/booking/hooks/useCheckAutoApproval";

const mockBookingContext = {
  bookingCalendarInfo: null,
  selectedRooms: [],
  formData: null,
  role: undefined,
  department: undefined,
  setDepartment: vi.fn(),
  setRole: vi.fn(),
  setFormData: vi.fn(),
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BookingContext.Provider value={mockBookingContext as any}>
      {children}
    </BookingContext.Provider>
  );
}

describe("useCheckAutoApproval – initial state", () => {
  it("should default isAutoApproval to false before eligibility check", () => {
    // Capture the value on every render to verify the initial state
    const renderValues: boolean[] = [];

    const { result } = renderHook(() => {
      const hook = useCheckAutoApproval();
      renderValues.push(hook.isAutoApproval);
      return hook;
    }, { wrapper });

    // The very first render must be false — this is the regression test.
    // Before the fix, useState(true) caused the first render to be true,
    // which flashed the auto-approval banner before useEffect ran.
    expect(renderValues[0]).toBe(false);

    // Final state should also be false (XState mock returns "Requested")
    expect(result.current.isAutoApproval).toBe(false);
  });
});
