import { getDeclineCcEmails } from "@/components/src/tenantPolicyServer";
import { BookingStatusLabel } from "@/components/src/types";

interface SendDeclineCcEmailsOptions {
  calendarEventId: string;
  /** The requester; skipped as a CC recipient and used as Reply-To. */
  guestEmail: string;
  /** The requester's decline message, sent unchanged. */
  headerMessage: string;
  tenant?: string;
}

/**
 * Sends the requester's decline email to every `ccEmails.declined` address,
 * one email per address. Never throws: a failure for one address is logged
 * and does not stop the others or the caller's remaining decline steps.
 * Resolves to the addresses it tried.
 */
export const sendDeclineCcEmails = async ({
  calendarEventId,
  guestEmail,
  headerMessage,
  tenant,
}: SendDeclineCcEmailsOptions): Promise<string[]> => {
  const tenantLabel = tenant?.toUpperCase() || "UNKNOWN";
  try {
    const recipients = await getDeclineCcEmails(tenant, guestEmail);
    if (recipients.length === 0) return [];

    // Imported lazily, as in the decline state handler, to keep this module
    // free of the admin server graph at load time.
    const { serverSendBookingDetailEmail } =
      await import("@/components/src/server/admin");
    const results = await Promise.allSettled(
      recipients.map((targetEmail) =>
        serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail,
          headerMessage,
          status: BookingStatusLabel.DECLINED,
          replyTo: guestEmail,
          tenant,
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          "🚨 DECLINE CC EMAIL FAILED [%s] %s:",
          tenantLabel,
          recipients[index],
          result.reason,
        );
      } else if (result.value && !result.value.ok) {
        console.error(
          "🚨 DECLINE CC EMAIL FAILED [%s] %s: email API returned %s",
          tenantLabel,
          recipients[index],
          result.value.status,
        );
      }
    });
    return recipients;
  } catch (error) {
    console.error("🚨 DECLINE CC EMAILS FAILED [%s]:", tenantLabel, error);
    return [];
  }
};
