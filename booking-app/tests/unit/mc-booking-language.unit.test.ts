import {
  applyMcBookingLanguage,
  MC_POLICY_HTML,
  MC_REQUESTED_USER_EMAIL,
} from "@/lib/tenant/mcBookingLanguage";
import { describe, expect, it } from "vitest";

const currentApproved = `This request has been approved!
<br />
<b>Reservation Check in</b><br />
Please plan to check in at the Media Commons Front Desk at the time of your reservation. If you are more than 30 minutes late for your reservation, it will be canceled and you will be marked as a "No-Show." For reservations in room 1201, you can go straight to the 12th floor without checking in. You can reply to this email to adjust your reservation time if plans change and you will be arriving later.
<br /><br />
<b>Equipment Check out</b><br />
If you requested equipment, keep this section.`;

const currentNoShow = `You have been marked as a 'No Show' and your reservation has been canceled due to not checking in within the first 30 minutes of your reservation.<br /><br />
Currently, you have <b>\${violationCount}</b> violation(s).`;

const current = {
  policy:
    "<p>Booking Confirmation</p><p>A request does not guarantee a booking.</p>",
  emailNotifications: {
    requestedUser:
      "Your request has been received!<br />This email does not confirm your reservation. You will receive a confirmation email and Google Calendar invite once your request is completed.",
    approvedUser: currentApproved,
    noShow: currentNoShow,
    declined: "Leave this alone.",
  },
};

describe("applyMcBookingLanguage", () => {
  it("updates the policy modal, Requested email, Approved check-in, and No Show opening", () => {
    const result = applyMcBookingLanguage(current);

    expect(result.errors).toEqual([]);
    expect(result.changes).toEqual([
      "policy",
      "emailNotifications.requestedUser",
      "emailNotifications.approvedUser",
      "emailNotifications.noShow",
    ]);
    expect(result.policy).toBe(MC_POLICY_HTML);
    expect(result.policy).toContain("full policy document");
    expect(result.policy).toContain(
      "https://sites.google.com/nyu.edu/370jmediacommons/about/our-policy",
    );
    expect(result.policy).toContain("<b>Access:</b>");
    expect(result.policy).toContain("at least 24 hours");
    expect(result.policy).toContain("mediacommons.reservations@nyu.edu");
    expect(result.policy).not.toContain("medicommons.reservations@nyu.edu");

    expect(result.emailNotifications.requestedUser).toBe(
      MC_REQUESTED_USER_EMAIL,
    );
    expect(result.emailNotifications.requestedUser).toContain(
      "Here is what each status means:",
    );
    expect(result.emailNotifications.requestedUser).toContain(
      "<b>Pre-approved:</b>",
    );
    expect(result.emailNotifications.requestedUser).toContain(
      "https://flowing-mantis-389917.uc.r.appspot.com/mc/admin",
    );

    expect(result.emailNotifications.approvedUser).toContain(
      "For events in the 1201 Seminar Room or 202 Lecture Hall, you can go directly to the room without checking in.",
    );
    expect(result.emailNotifications.approvedUser).toContain(
      "<b>Equipment Check out</b>",
    );
    expect(result.emailNotifications.approvedUser).not.toContain(
      "go straight to the 12th floor",
    );

    expect(result.emailNotifications.noShow).toContain(
      "checking in at the Media Commons Front Desk",
    );
    expect(result.emailNotifications.noShow).toContain(
      "request for this No Show to be waived",
    );
    expect(result.emailNotifications.noShow).toContain("${violationCount}");
    expect(result.emailNotifications.declined).toBe("Leave this alone.");
  });

  it("does nothing when the schema already has the new copy", () => {
    const updated = applyMcBookingLanguage(current);
    const again = applyMcBookingLanguage(updated);

    expect(again.errors).toEqual([]);
    expect(again.changes).toEqual([]);
    expect(again.policy).toBe(updated.policy);
    expect(again.emailNotifications).toEqual(updated.emailNotifications);
  });

  it("refuses to write when the stored sentence has drifted", () => {
    const result = applyMcBookingLanguage({
      policy: "<p>Something else entirely.</p>",
      emailNotifications: {
        requestedUser: "A custom requested message.",
        approvedUser: "A custom approval message.",
        noShow: "A custom no show message with ${violationCount}.",
      },
    });

    expect(result.changes).toEqual([]);
    expect(result.errors).toEqual([
      "policy does not contain the expected Media Commons policy text",
      "emailNotifications.requestedUser does not contain the expected Requested email",
      "emailNotifications.approvedUser does not contain the expected sentence to replace",
      "emailNotifications.noShow does not contain the expected sentence to replace",
    ]);
    expect(result.emailNotifications.noShow).toContain("${violationCount}");
  });
});
