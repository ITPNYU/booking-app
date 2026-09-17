import {
  BookingContext,
  BookingContextType,
  BookingProvider,
} from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { PagePermission } from "@/components/src/types";
import { act, render } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/fetchCalendarEvents",
  () => ({
    default: () => ({
      existingCalendarEvents: [],
      reloadExistingCalendarEvents: vi.fn(),
      fetchingStatus: "loaded",
    }),
  }),
);

const mockDatabaseContext = {
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  userEmail: "test@nyu.edu",
  blackoutPeriods: [],
  reloadSafetyTrainedUsers: vi.fn(),
  pagePermission: PagePermission.BOOKING,
};

let context: BookingContextType;

const Probe = () => {
  context = useContext(BookingContext);
  return null;
};

const tree = () => (
  <DatabaseContext.Provider value={mockDatabaseContext as any}>
    <BookingProvider>
      <Probe />
    </BookingProvider>
  </DatabaseContext.Provider>
);

const navigate = (rerender: (ui: React.ReactElement) => void, path: string) => {
  (usePathname as any).mockReturnValue(path);
  rerender(tree());
};

describe("BookingProvider - state scoped to the current request", () => {
  beforeEach(() => {
    (usePathname as any).mockReturnValue("/mc/book/form");
  });

  it("keeps Details validity across the steps of one request", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));

    navigate(rerender, "/mc/book/services");

    expect(context.isDetailsValid).toBe(true);
  });

  it("does not carry Details validity into another flow", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));

    navigate(rerender, "/mc/walk-in/services");

    expect(context.isDetailsValid).toBe(false);
  });

  it("does not carry Details validity into another booking of the same flow", () => {
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));

    navigate(rerender, "/mc/edit/services/evt2");

    expect(context.isDetailsValid).toBe(false);
  });

  it("does not revive Details validity on returning to the first flow", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));

    navigate(rerender, "/mc/walk-in/form");
    act(() => context.setIsDetailsValid(false));
    navigate(rerender, "/mc/book/services");

    expect(context.isDetailsValid).toBe(false);
  });

  it("keeps the service rule memory across the steps of one request", () => {
    const { rerender } = render(tree());
    context.serviceRuleMemory.cleaningAutoSet = true;

    navigate(rerender, "/mc/book/services");

    expect(context.serviceRuleMemory.cleaningAutoSet).toBe(true);
  });

  it("clears the service rule memory when the request changes", () => {
    const { rerender } = render(tree());
    context.serviceRuleMemory.cleaningAutoSet = true;
    const fresh = { ...context.serviceRuleMemory, cleaningAutoSet: false };

    navigate(rerender, "/mc/walk-in/services");

    expect(context.serviceRuleMemory).toEqual(fresh);
  });
});
