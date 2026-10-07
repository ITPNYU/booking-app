import {
  BookingContext,
  BookingContextType,
  BookingProvider,
} from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { PagePermission, Role, RoomSetting } from "@/components/src/types";
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

  it("drops Details validity when the selected rooms change", () => {
    const small = { roomId: "101", name: "A", capacity: "10" } as RoomSetting;
    const large = { roomId: "102", name: "B", capacity: "50" } as RoomSetting;
    render(tree());
    act(() => context.setSelectedRooms([large]));
    act(() => context.setIsDetailsValid(true));
    expect(context.isDetailsValid).toBe(true);

    act(() => context.setSelectedRooms([small]));

    expect(context.isDetailsValid).toBe(false);
  });

  it("drops Details validity when the role changes", () => {
    render(tree());
    act(() => context.setRole(Role.FACULTY));
    act(() => context.setIsDetailsValid(true));
    expect(context.isDetailsValid).toBe(true);

    act(() => context.setRole(Role.STUDENT));

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

  it("keeps ticked agreements across the steps of one request", () => {
    const { rerender } = render(tree());
    act(() => context.setCheckedAgreements({ policy: true }));

    navigate(rerender, "/mc/book/services");

    expect(context.checkedAgreements).toEqual({ policy: true });
  });

  it("does not carry ticked agreements into another request", () => {
    const { rerender } = render(tree());
    act(() => context.setCheckedAgreements({ policy: true }));

    navigate(rerender, "/mc/walk-in/form");

    expect(context.checkedAgreements).toEqual({});
  });

  it("starts a new attempt when the flow is re-entered through its landing page", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));
    act(() => context.setCheckedAgreements({ policy: true }));
    context.serviceRuleMemory.cleaningAutoSet = true;

    navigate(rerender, "/mc/book");
    navigate(rerender, "/mc/book/form");

    expect(context.isDetailsValid).toBe(false);
    expect(context.checkedAgreements).toEqual({});
    expect(context.serviceRuleMemory.cleaningAutoSet).toBe(false);
  });

  it("starts a new attempt when the flow is left for another page", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));
    act(() => context.setCheckedAgreements({ policy: true }));

    navigate(rerender, "/mc/my-bookings");
    navigate(rerender, "/mc/book/form");

    expect(context.isDetailsValid).toBe(false);
    expect(context.checkedAgreements).toEqual({});
  });

  it("starts a new attempt when the same booking is reopened from its landing page", () => {
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const { rerender } = render(tree());
    act(() => context.setCheckedAgreements({ policy: true }));

    navigate(rerender, "/mc/edit/evt1");
    navigate(rerender, "/mc/edit/form/evt1");

    expect(context.checkedAgreements).toEqual({});
  });

  it("keeps the submit status across the steps of one request", () => {
    const { rerender } = render(tree());
    act(() => context.setSubmitting("success"));

    navigate(rerender, "/mc/book/confirmation");

    expect(context.submitting).toBe("success");
  });

  it("does not carry a successful submission into the next attempt", () => {
    const { rerender } = render(tree());
    const initial = context.submitting;
    act(() => context.setSubmitting("success"));

    navigate(rerender, "/mc/my-bookings");
    navigate(rerender, "/mc/book/services");

    expect(context.submitting).toBe(initial);
    expect(context.submitting).not.toBe("success");
  });

  it("ignores a submission that settles after its request was left", () => {
    const { rerender } = render(tree());
    const settle = context.setSubmitting;

    navigate(rerender, "/mc/book");
    navigate(rerender, "/mc/book/form");
    act(() => settle("success"));

    expect(context.submitting).not.toBe("success");
  });

  it.each([
    ["/mc/edit/form/evt1", "/mc/book/confirmation"],
    ["/mc/modification/form/evt1", "/mc/modification/confirmation"],
    ["/mc/walk-in/services", "/mc/walk-in/confirmation"],
  ])(
    "reports a submission from %s on its confirmation page %s",
    (stepPath, confirmationPath) => {
      (usePathname as any).mockReturnValue(stepPath);
      const { rerender } = render(tree());
      // The request settles after the redirect, through the setter the
      // submitting step captured.
      const settle = context.setSubmitting;
      act(() => settle("submitting"));

      navigate(rerender, confirmationPath);
      expect(context.submitting).toBe("submitting");
      act(() => settle("success"));

      expect(context.submitting).toBe("success");
    },
  );

  it("does not carry a submission from a confirmation page into the next request", () => {
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const { rerender } = render(tree());
    act(() => context.setSubmitting("success"));
    navigate(rerender, "/mc/book/confirmation");

    navigate(rerender, "/mc/book/form");

    expect(context.submitting).not.toBe("success");
  });

  it("starts a new attempt when a step is reached back from the confirmation page", () => {
    const { rerender } = render(tree());
    act(() => context.setIsDetailsValid(true));
    act(() => context.setSubmitting("success"));
    navigate(rerender, "/mc/book/confirmation");
    expect(context.submitting).toBe("success");

    navigate(rerender, "/mc/book/form");

    expect(context.submitting).not.toBe("success");
    expect(context.isDetailsValid).toBe(false);
  });

  it("does not prune a saved booking loaded after another one", () => {
    const roomA = { roomId: "101", name: "A", capacity: "10" } as RoomSetting;
    const roomB = { roomId: "102", name: "B", capacity: "10" } as RoomSetting;
    const saved = (title: string) =>
      ({ title, cateringByRoom: { "101": "yes", "102": "yes" } }) as any;
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const { rerender } = render(tree());
    act(() => {
      context.setSelectedRooms([roomA]);
      context.setFormData(saved("first"));
    });

    navigate(rerender, "/mc/edit/form/evt2");
    act(() => {
      context.setSelectedRooms([roomB]);
      context.setFormData(saved("second"));
    });

    expect(context.formData?.cateringByRoom).toEqual({
      "101": "yes",
      "102": "yes",
    });
  });

  it("still prunes when a room is removed within the request", () => {
    const roomA = { roomId: "101", name: "A", capacity: "10" } as RoomSetting;
    const roomB = { roomId: "102", name: "B", capacity: "10" } as RoomSetting;
    (usePathname as any).mockReturnValue("/mc/edit/form/evt1");
    const { rerender } = render(tree());
    navigate(rerender, "/mc/edit/form/evt2");
    act(() => {
      context.setSelectedRooms([roomA, roomB]);
      context.setFormData({
        cateringByRoom: { "101": "yes", "102": "yes" },
      } as any);
    });

    act(() => context.setSelectedRooms([roomA]));

    expect(context.formData?.cateringByRoom).toEqual({ "101": "yes" });
  });

  it("forgets the per-room rule memory of a room that is removed", () => {
    const roomA = { roomId: "101", name: "A", capacity: "10" } as RoomSetting;
    const roomB = { roomId: "102", name: "B", capacity: "10" } as RoomSetting;
    render(tree());
    act(() => context.setSelectedRooms([roomA, roomB]));
    context.serviceRuleMemory.cleaningAutoSetByRoom["101"] = true;
    context.serviceRuleMemory.cleaningAutoSetByRoom["102"] = true;
    context.serviceRuleMemory.securityAutoSetByRoom["102"] = true;

    act(() => context.setSelectedRooms([roomA]));

    expect(context.serviceRuleMemory.cleaningAutoSetByRoom).toEqual({
      "101": true,
    });
    expect(context.serviceRuleMemory.securityAutoSetByRoom).toEqual({});
  });
});
