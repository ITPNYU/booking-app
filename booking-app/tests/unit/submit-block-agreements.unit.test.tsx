import {
  BookingContext,
  BookingContextType,
  BookingProvider,
} from "@/components/src/client/routes/booking/bookingProvider";
import SubmitBlock from "@/components/src/client/routes/booking/components/SubmitBlock";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { FormContextLevel, PagePermission } from "@/components/src/types";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mc/book/services",
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

const schema = coerceTenantSchema(
  {
    tenantId: "mc",
    attestations: [{ id: "agreement1", html: "<p>I agree</p>" }],
    resources: [],
  },
  "mc",
);

const databaseContext = {
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  userEmail: "test@nyu.edu",
  blackoutPeriods: [],
  reloadSafetyTrainedUsers: vi.fn(),
  pagePermission: PagePermission.BOOKING,
} as any;

let context: BookingContextType;

const Probe = () => {
  context = useContext(BookingContext);
  return null;
};

const tree = (showSubmitBlock: boolean) => (
  <DatabaseContext.Provider value={databaseContext}>
    <SchemaProvider value={schema}>
      <BookingProvider>
        <Probe />
        {showSubmitBlock && (
          <SubmitBlock
            formContext={FormContextLevel.FULL_FORM}
            isValid
            isSubmitting={false}
          />
        )}
      </BookingProvider>
    </SchemaProvider>
  </DatabaseContext.Provider>
);

describe("SubmitBlock - agreement attestations", () => {
  it("keeps a ticked attestation when the submit block remounts", async () => {
    const user = userEvent.setup();
    const { rerender } = render(tree(true));
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();

    rerender(tree(false));
    rerender(tree(true));

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("starts unticked again once the request's answers are cleared", async () => {
    const user = userEvent.setup();
    render(tree(true));
    await user.click(screen.getByRole("checkbox"));

    act(() => context.setCheckedAgreements({}));

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});
