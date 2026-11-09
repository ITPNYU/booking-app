import { describe, expect, it } from "vitest";
import { BookingStatusLabel } from "@/components/src/types";
import {
  buildRequesterUpdates,
  canReassignRequester,
  newRequesterHeaderMessage,
  previousRequesterHeaderMessage,
  reassignmentHistoryNote,
  validateReassignRequesterInput,
} from "@/components/src/utils/reassignRequester";

const validBody = {
  calendarEventId: "evt-1",
  netId: " NEW456 ",
  firstName: " Pat ",
  lastName: " Lee ",
  nNumber: "N12345678",
  phoneNumber: "212-555-0199",
};

describe("canReassignRequester", () => {
  it.each([
    BookingStatusLabel.REQUESTED,
    BookingStatusLabel.PRE_APPROVED,
    BookingStatusLabel.APPROVED,
    BookingStatusLabel.DECLINED,
  ])("allows %s bookings", (status) => {
    expect(canReassignRequester(status)).toBe(true);
  });

  it.each([
    BookingStatusLabel.CHECKED_IN,
    BookingStatusLabel.CHECKED_OUT,
    BookingStatusLabel.CLOSED,
    BookingStatusLabel.CANCELED,
    BookingStatusLabel.NO_SHOW,
    "Services Request",
  ])("refuses %s bookings", (status) => {
    expect(canReassignRequester(status)).toBe(false);
  });
});

describe("validateReassignRequesterInput", () => {
  it("trims the fields, lowercases the NetID and turns both emails on by default", () => {
    expect(validateReassignRequesterInput(validBody)).toEqual({
      ok: true,
      value: {
        calendarEventId: "evt-1",
        netId: "new456",
        firstName: "Pat",
        lastName: "Lee",
        nNumber: "N12345678",
        phoneNumber: "212-555-0199",
        notifyNewRequester: true,
        notifyPreviousRequester: true,
      },
    });
  });

  it("keeps notifications off when the admin turned them off", () => {
    const result = validateReassignRequesterInput({
      ...validBody,
      notifyNewRequester: false,
      notifyPreviousRequester: false,
    });
    expect(result.ok && result.value.notifyNewRequester).toBe(false);
    expect(result.ok && result.value.notifyPreviousRequester).toBe(false);
  });

  it("accepts a blank N-Number", () => {
    const result = validateReassignRequesterInput({ ...validBody, nNumber: "" });
    expect(result.ok).toBe(true);
  });

  it.each([
    [{ calendarEventId: "" }, "calendarEventId required"],
    [{ netId: "not a netid" }, "Enter a valid NYU NetID (e.g. abc123)"],
    [{ firstName: "  " }, "First and last name are required"],
    [{ lastName: "x".repeat(101) }, "Names must be at most 100 characters"],
    [{ phoneNumber: "123" }, "Enter a valid 10 digit phone number"],
    [{ nNumber: "12345678" }, "Invalid N-Number"],
  ])("rejects %j", (override, error) => {
    expect(validateReassignRequesterInput({ ...validBody, ...override })).toEqual(
      { ok: false, error },
    );
  });

  it("rejects a missing body", () => {
    expect(validateReassignRequesterInput(null).ok).toBe(false);
  });
});

describe("buildRequesterUpdates", () => {
  const input = {
    netId: "new456",
    firstName: "Pat",
    lastName: "Lee",
    nNumber: "N12345678",
    phoneNumber: "2125550199",
  };

  it("writes only the requester fields on a booking without machine data", () => {
    expect(
      buildRequesterUpdates(
        { email: "old123@nyu.edu", role: "Student", department: "ITP" },
        input,
      ),
    ).toEqual({
      email: "new456@nyu.edu",
      netId: "new456",
      firstName: "Pat",
      lastName: "Lee",
      nNumber: "N12345678",
      phoneNumber: "2125550199",
    });
  });

  it("moves the walk-in NetID on walk-ins", () => {
    const updates = buildRequesterUpdates({ walkInNetId: "old123" }, input);
    expect(updates.walkInNetId).toBe("new456");
  });

  it("updates the saved machine context so its copy is not stale", () => {
    const updates = buildRequesterUpdates(
      {
        xstateData: {
          snapshot: {
            context: {
              email: "old123@nyu.edu",
              formData: { netId: "old123", walkInNetId: "old123" },
            },
          },
        },
      },
      input,
    );
    expect(updates).toMatchObject({
      "xstateData.snapshot.context.email": "new456@nyu.edu",
      "xstateData.snapshot.context.formData.netId": "new456",
      "xstateData.snapshot.context.formData.firstName": "Pat",
      "xstateData.snapshot.context.formData.walkInNetId": "new456",
    });
    expect(updates).not.toHaveProperty(
      "xstateData.snapshot.context.formData.email",
    );
  });

  it("does not create form data the machine context never had", () => {
    const updates = buildRequesterUpdates(
      { xstateData: { snapshot: { context: { email: "old123@nyu.edu" } } } },
      input,
    );
    expect(
      Object.keys(updates).filter((key) => key.includes("formData")),
    ).toEqual([]);
  });
});

describe("email and history wording", () => {
  const messages = {
    requestedUser: "We got your request.",
    approvedUser: "Your reservation is approved.",
    approvedWalkIn: "Your walk-in is approved.",
    approvedVIP: "Your VIP booking is approved.",
    declined: "Your request was declined.",
  };

  it.each([
    [BookingStatusLabel.APPROVED, "user", messages.approvedUser],
    [BookingStatusLabel.APPROVED, "walk-in", messages.approvedWalkIn],
    [BookingStatusLabel.APPROVED, "vip", messages.approvedVIP],
    [BookingStatusLabel.REQUESTED, "user", messages.requestedUser],
    [BookingStatusLabel.PRE_APPROVED, "user", messages.requestedUser],
    [BookingStatusLabel.DECLINED, "user", messages.declined],
  ])("tells the new requester about a %s %s booking", (status, origin, text) => {
    expect(newRequesterHeaderMessage(status, origin, messages)).toBe(
      `This reservation has been assigned to you.<br /><br />${text}`,
    );
  });

  it("falls back to the intro when the tenant has no message", () => {
    expect(
      newRequesterHeaderMessage(BookingStatusLabel.APPROVED, "user", {}),
    ).toBe("This reservation has been assigned to you.");
  });

  it("tells the previous requester who holds the booking now", () => {
    expect(previousRequesterHeaderMessage("Pat Lee", "new456@nyu.edu")).toBe(
      "This reservation has been reassigned to Pat Lee (new456@nyu.edu). It no longer appears in your bookings.",
    );
  });

  it("names both requesters in the history note", () => {
    expect(reassignmentHistoryNote("old123@nyu.edu", "new456@nyu.edu")).toBe(
      "Requester changed from old123@nyu.edu to new456@nyu.edu",
    );
  });
});
