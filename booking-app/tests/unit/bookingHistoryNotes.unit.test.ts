import { BookingStatusLabel, PagePermission } from "@/components/src/types";
import {
  ADMIN_POLICY_APPROVED_NOTE,
  DEPARTMENTAL_LIAISON_APPROVED_NOTE,
  firstApprovalHistoryNote,
  resolvePreApprovedHistoryNotes,
  serviceHistoryNote,
} from "@/components/src/utils/bookingHistoryNotes";
import { describe, expect, it } from "vitest";

describe("bookingHistoryNotes", () => {
  it("keeps an existing PRE-APPROVED note", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          note: "Equipment Service Approved",
          changedBy: "approver@nyu.edu",
        },
      ]),
    ).toEqual(["Equipment Service Approved"]);
  });

  it("labels the first unlabeled human PRE-APPROVED as liaison", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "liaison@nyu.edu",
        },
      ]),
    ).toEqual([DEPARTMENTAL_LIAISON_APPROVED_NOTE]);
  });

  it("labels the second unlabeled human PRE-APPROVED as admin policy", () => {
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
    ).toEqual([
      DEPARTMENTAL_LIAISON_APPROVED_NOTE,
      ADMIN_POLICY_APPROVED_NOTE,
    ]);
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

  it("treats lowercase system as System", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "system",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([undefined, ADMIN_POLICY_APPROVED_NOTE]);
  });

  it("labels the first unlabeled human after System as admin policy", () => {
    expect(
      resolvePreApprovedHistoryNotes([
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "System",
        },
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "admin@nyu.edu",
        },
      ]),
    ).toEqual([undefined, ADMIN_POLICY_APPROVED_NOTE]);
  });

  it("does not relabel liaison after a stored liaison note", () => {
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
    ).toEqual([
      DEPARTMENTAL_LIAISON_APPROVED_NOTE,
      ADMIN_POLICY_APPROVED_NOTE,
    ]);
  });

  it("leaves a third unlabeled human PRE-APPROVED blank", () => {
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
        {
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "other@nyu.edu",
        },
      ]),
    ).toEqual([
      DEPARTMENTAL_LIAISON_APPROVED_NOTE,
      ADMIN_POLICY_APPROVED_NOTE,
      undefined,
    ]);
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
