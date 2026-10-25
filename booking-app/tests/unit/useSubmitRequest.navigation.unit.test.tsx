import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { rememberDashboardReturn } from "@/components/src/client/routes/components/bookingTable/dashboardView";
import useSubmitRequest from "@/components/src/client/routes/booking/hooks/useSubmitRequest";
import { FormContextLevel, Inputs, PagePermission } from "@/components/src/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useParams, useRouter } from "next/navigation";

const push = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const registerEvent = vi.hoisted(() => vi.fn());

vi.mock("@/components/src/client/routes/booking/hooks/useSubmitBooking", () => ({
  default: () => registerEvent,
}));

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({
    default: () => ({ isAutoApproval: false }),
  }),
);

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <DatabaseContext.Provider
      value={{ pagePermission: PagePermission.ADMIN } as any}
    >
      <BookingContext.Provider
        value={
          {
            bookingCalendarInfo: { start: new Date() },
            department: undefined,
            role: undefined,
            formData: undefined,
          } as any
        }
      >
        {children}
      </BookingContext.Provider>
    </DatabaseContext.Provider>
  );
}

async function submit(formContext: FormContextLevel) {
  const { result } = renderHook(
    () => useSubmitRequest(formContext, "evt1"),
    { wrapper },
  );
  const handleSubmit = (onValid: (data: Inputs) => void) => () => {
    onValid({} as Inputs);
  };
  await act(async () => {
    result.current.createSubmitHandler(handleSubmit as any)({} as any);
  });
}

describe("submit navigation", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    registerEvent.mockReset();
    registerEvent.mockResolvedValue("success");
    sessionStorage.clear();
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
      back: vi.fn(),
    } as any);
    vi.mocked(useParams).mockReturnValue({ tenant: "mc" });
    window.history.pushState({}, "", "/mc/admin?q=jane&range=Today");
  });

  it("sends an edit to the edit confirmation page", async () => {
    await submit(FormContextLevel.EDIT);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/mc/edit/confirmation"),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a new booking to the booking confirmation page", async () => {
    rememberDashboardReturn("edit", "evt1");

    await submit(FormContextLevel.FULL_FORM);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/mc/book/confirmation"),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a staff modification back to the stored dashboard", async () => {
    rememberDashboardReturn("modification", "evt1");

    await submit(FormContextLevel.MODIFICATION);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/mc/admin?q=jane&range=Today"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores a dashboard stored for another booking", async () => {
    rememberDashboardReturn("modification", "other-evt");

    await submit(FormContextLevel.MODIFICATION);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mc/admin"));
    expect(sessionStorage.getItem("bookingDashboardReturnTo")).toBeNull();
  });

  it("drops an edit return stored for another booking", async () => {
    rememberDashboardReturn("edit", "other-evt");

    await submit(FormContextLevel.EDIT);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/mc/edit/confirmation"),
    );
    expect(sessionStorage.getItem("bookingDashboardReturnTo")).toBeNull();
  });
});
