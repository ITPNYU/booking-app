import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import useBookingActions, {
  Actions,
} from "@/components/src/client/routes/admin/hooks/useBookingActions";

import MockDate from "mockdate";
import { Timestamp } from "@firebase/firestore";
import { renderHook } from "@testing-library/react";

function testActionWithStatus(
  action: Actions,
  status: BookingStatusLabel,
  shouldHave: boolean
) {
  const date = new Date().getTime() + 60 * 60 * 1000;
  const hook = renderHook(() =>
    useBookingActions({
      status,
      calendarEventId: "abc",
      pageContext: PageContextLevel.USER,
      startDate: Timestamp.fromDate(new Date(date)),
      reason: "decline reason",
    })
  );
  const { options } = hook.result.current;

  if (shouldHave) {
    expect(options).toContain(action);
  } else {
    expect(options).not.toContain(action);
  }
}

describe("Available Booking Actions", () => {
  it("User isn't given EDIT action with booking status CHECKED IN", () => {
    testActionWithStatus(Actions.EDIT, BookingStatusLabel.CHECKED_IN, false);
  });
  it("User isn't given EDIT action with booking status CHECKED OUT", () => {
    testActionWithStatus(Actions.EDIT, BookingStatusLabel.CHECKED_OUT, false);
  });
  it("User isn't given EDIT action with booking status NO SHOW", () => {
    testActionWithStatus(Actions.EDIT, BookingStatusLabel.NO_SHOW, false);
  });
  it("User isn't given CANCEL action with booking status CHECKED IN", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.CHECKED_IN, false);
  });
  it("User isn't given CANCEL action with booking status CHECKED OUT", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.CHECKED_OUT, false);
  });
  it("User isn't given CANCEL action with booking status NO SHOW", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.NO_SHOW, false);
  });

  it("User is given CANCEL action with booking status APPROVED", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.APPROVED, true);
  });
  it("User is given CANCEL action with booking status PENDING", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.PENDING, true);
  });
  it("User is given CANCEL action with booking status REQUESTED", () => {
    testActionWithStatus(Actions.CANCEL, BookingStatusLabel.REQUESTED, true);
  });
  it("User is given EDIT action with booking status APPROVED", () => {
    testActionWithStatus(Actions.EDIT, BookingStatusLabel.APPROVED, true);
  });
  it("User is given EDIT action with booking status REQUESTED", () => {
    testActionWithStatus(Actions.EDIT, BookingStatusLabel.REQUESTED, true);
  });

  it("User isn't given EDIT action after booking has started", () => {
    const date = new Date().getTime() - 60 * 1000;
    const hook = renderHook(() =>
      useBookingActions({
        status: BookingStatusLabel.APPROVED,
        calendarEventId: "abc",
        pageContext: PageContextLevel.USER,
        startDate: Timestamp.fromDate(new Date(date)),
        reason: "decline reason",
      })
    );
    const { options } = hook.result.current;
    expect(options).not.toContain(Actions.EDIT);
  });

  it("User is given no actions with status CANCELED", () => {
    const hook = renderHook(() =>
      useBookingActions({
        status: BookingStatusLabel.CANCELED,
        calendarEventId: "abc",
        pageContext: PageContextLevel.USER,
        startDate: Timestamp.now(),
        reason: "decline reason",
      })
    );
    const { options } = hook.result.current;
    expect(options).toHaveLength(0);
  });
  it("User is given no actions with status DECLINED", () => {
    const hook = renderHook(() =>
      useBookingActions({
        status: BookingStatusLabel.DECLINED,
        calendarEventId: "abc",
        pageContext: PageContextLevel.USER,
        startDate: Timestamp.now(),
        reason: "decline reason",
      })
    );
    const { options } = hook.result.current;
    expect(options).toHaveLength(0);
  });
});
