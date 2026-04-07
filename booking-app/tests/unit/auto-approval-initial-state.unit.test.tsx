import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

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
  it("should default isAutoApproval to false and isCheckingAutoApproval to true before eligibility check", () => {
    // Capture values on every render to verify the initial state
    const renderValues: { isAutoApproval: boolean; isCheckingAutoApproval: boolean }[] = [];

    const { result } = renderHook(() => {
      const hook = useCheckAutoApproval();
      renderValues.push({
        isAutoApproval: hook.isAutoApproval,
        isCheckingAutoApproval: hook.isCheckingAutoApproval,
      });
      return hook;
    }, { wrapper });

    // The very first render must have isAutoApproval=false and isCheckingAutoApproval=true.
    // Before the fix, useState(true) caused the first render to flash the
    // auto-approval banner before useEffect ran.
    expect(renderValues[0].isAutoApproval).toBe(false);
    expect(renderValues[0].isCheckingAutoApproval).toBe(true);

    // Final state: check complete, auto-approval rejected (XState mock returns "Requested")
    expect(result.current.isAutoApproval).toBe(false);
    expect(result.current.isCheckingAutoApproval).toBe(false);
  });
});
