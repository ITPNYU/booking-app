import { BookingStatusLabel, PagePermission } from "@/components/src/types";
import {
  ADMIN_POLICY_APPROVED_NOTE,
  DEPARTMENTAL_LIAISON_APPROVED_NOTE,
  firstApprovalHistoryNote,
  resolvePreApprovedHistoryNotes,
  MAX_ACTION_NOTE_LENGTH,
  normalizeActionNote,
  serviceHistoryNote,
  withActionNote,
} from "@/components/src/utils/bookingHistoryNotes";
import { describe, expect, it } from "vitest";

describe("bookingHistoryNotes", () => {
  it("keeps existing PRE-APPROVED notes", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          note: "Equipment Service Approved",
          changedBy: "approver@nyu.edu",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          note: DEPARTMENTAL_LIAISON_APPROVED_NOTE,
          changedBy: "liaison@nyu.edu",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          note: ADMIN_POLICY_APPROVED_NOTE,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([
      "Equipment Service Approved",
      DEPARTMENTAL_LIAISON_APPROVED_NOTE,
      ADMIN_POLICY_APPROVED_NOTE,
    ]);
  });

  it("does not invent a liaison note for a single unlabeled PRE-APPROVED", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([undefined]);
  });

  it("does not invent notes for unlabeled PRE-APPROVED rows", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "liaison@nyu.edu",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([undefined, undefined]);
  });

  it("does not invent a note for System PRE-APPROVED rows", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "System",
        },
      ]),
    ).toEqual([undefined]);
  });

  it("keeps a stored liaison note and leaves a later unlabeled row blank", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          note: DEPARTMENTAL_LIAISON_APPROVED_NOTE,
          changedBy: "liaison@nyu.edu",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([DEPARTMENTAL_LIAISON_APPROVED_NOTE, undefined]);
  });

  it("omits a first-approval note for System actors", () => {
    expect(firstApprovalHistoryNote("System", PagePermission.ADMIN)).toBe(
      undefined,
    );
    expect(firstApprovalHistoryNote("system")).toBe(undefined);
  });

  it("labels first approval by Admin or Super Admin as admin policy", () => {
    expect(
      firstApprovalHistoryNote("admin@nyu.edu", PagePermission.ADMIN),
    ).toBe(ADMIN_POLICY_APPROVED_NOTE);
    expect(
      firstApprovalHistoryNote("super@nyu.edu", PagePermission.SUPER_ADMIN),
    ).toBe(ADMIN_POLICY_APPROVED_NOTE);
  });

  it("labels first approval by a liaison (or unknown role) as liaison", () => {
    expect(
      firstApprovalHistoryNote("liaison@nyu.edu", PagePermission.LIAISON),
    ).toBe(DEPARTMENTAL_LIAISON_APPROVED_NOTE);
    expect(firstApprovalHistoryNote("approver@nyu.edu")).toBe(
      DEPARTMENTAL_LIAISON_APPROVED_NOTE,
    );
  });

  it("uses Staffing for staff service history notes", () => {
    expect(serviceHistoryNote("staff", "approve")).toBe(
      "Staffing Service Approved",
    );
    expect(serviceHistoryNote("equipment", "approve")).toBe(
      "Equipment Service Approved",
    );
    expect(serviceHistoryNote("setup", "approve")).toBe(
      "Setup Service Approved",
    );
    expect(serviceHistoryNote("staff", "decline", "out of stock")).toBe(
      "Staffing Service Declined: out of stock",
    );
    expect(serviceHistoryNote("staff", "closeout")).toBe(
      "Staffing Service Closed Out",
    );
    expect(serviceHistoryNote("projection", "approve")).toBe(
      "Projection Service Approved",
    );
  });
});

describe("action notes", () => {
  it("trims a typed note and treats a blank or non-string one as missing", () => {
    expect(normalizeActionNote("  Called the requester  ")).toBe(
      "Called the requester",
    );
    expect(normalizeActionNote("   ")).toBeUndefined();
    expect(normalizeActionNote(undefined)).toBeUndefined();
    expect(normalizeActionNote(42)).toBeUndefined();
    expect(normalizeActionNote({ note: "x" })).toBeUndefined();
  });

  it("caps a typed note at MAX_ACTION_NOTE_LENGTH", () => {
    expect(normalizeActionNote("a".repeat(MAX_ACTION_NOTE_LENGTH + 50))).toBe(
      "a".repeat(MAX_ACTION_NOTE_LENGTH),
    );
  });

  it("adds the typed note after the system note", () => {
    expect(withActionNote("Admin Policy Approved", " Budget ok ")).toBe(
      "Admin Policy Approved: Budget ok",
    );
    expect(withActionNote(undefined, "Budget ok")).toBe("Budget ok");
    expect(withActionNote("", "Budget ok")).toBe("Budget ok");
    expect(withActionNote("Admin Policy Approved", "  ")).toBe(
      "Admin Policy Approved",
    );
    expect(withActionNote(undefined, undefined)).toBeUndefined();
  });

  it("adds a note to service approvals and closeouts, not only declines", () => {
    expect(serviceHistoryNote("catering", "approve", "Menu confirmed")).toBe(
      "Catering Service Approved: Menu confirmed",
    );
    expect(serviceHistoryNote("staff", "closeout", "Tech left at 6pm")).toBe(
      "Staffing Service Closed Out: Tech left at 6pm",
    );
    expect(serviceHistoryNote("staff", "decline", "  ")).toBe(
      "Staffing Service Declined",
    );
  });
});
