"use client";

import React, { Suspense, useContext, useEffect, useState } from "react";

import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import {
  ApprovedWithWarningError,
  NotAnApproverError,
  clientApproveBooking,
  decline,
} from "@/components/src/client/bookingActionClient";
import { CenterLoading } from "@/components/src/client/routes/components/Loading";
import getBookingStatus from "@/components/src/client/routes/hooks/getBookingStatus";
import { formatDate, formatTimeAmPm } from "@/components/src/client/utils/date";
import { TableNames } from "@/components/src/policy";
import { Booking, BookingStatusLabel } from "@/components/src/types";
import { MAX_ACTION_NOTE_LENGTH } from "@/components/src/utils/bookingHistoryNotes";
import { canAccessAdmin } from "@/components/src/utils/permissions";
import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { timestampToDate } from "@/lib/utils/timestampWire";
import { Alert, Button, TextField } from "@mui/material";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// Statuses the admin page offers an approve action for. Decline is offered
// for the same ones, since this page is for the approval decision.
const APPROVABLE_STATUSES = new Set<string>([
  BookingStatusLabel.REQUESTED,
  BookingStatusLabel.PRE_APPROVED,
  BookingStatusLabel.EQUIPMENT,
]);

const NOT_AN_APPROVER_MESSAGE =
  "You are not an approver for this booking, so you can't approve or decline it. If you think you should be, contact the admins.";

const formatBookingTime = (booking: Booking) => {
  const start = timestampToDate(booking.startDate);
  const end = timestampToDate(booking.endDate);
  if (!start) return "";
  return `${formatDate(start)}${end ? ` – ${formatTimeAmPm(end)}` : ""}`;
};

const ApprovePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const { tenant } = useParams<{ tenant: string }>();
  const router = useRouter();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  // undefined while loading; null when the lookup found nothing, which is
  // also what it returns when the request failed.
  const [booking, setBooking] = useState<Booking | null | undefined>(
    undefined,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [reason, setReason] = useState("");
  // Optional note recorded with the approval in the booking history.
  const [approvalNote, setApprovalNote] = useState("");
  const [notApprover, setNotApprover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { userEmail, pagePermission, permissionsLoading } =
    useContext(DatabaseContext);

  // Final-approver emails link here so non-admin resource approvers have a
  // page they can open; admins keep approving from the admin page.
  const redirectToAdmin = !permissionsLoading && canAccessAdmin(pagePermission);

  useEffect(() => {
    if (!redirectToAdmin || !paramCalendarEventId) return;
    router.replace(
      `/${tenant}/admin?calendarEventId=${encodeURIComponent(paramCalendarEventId)}`,
    );
  }, [redirectToAdmin, paramCalendarEventId, tenant, router]);

  useEffect(() => {
    if (permissionsLoading || redirectToAdmin || !paramCalendarEventId) return;
    let cancelled = false;
    clientGetDataByCalendarEventId<Booking>(
      TableNames.BOOKING,
      paramCalendarEventId,
      tenant,
    ).then((data) => {
      if (!cancelled) setBooking(data);
    });
    return () => {
      cancelled = true;
    };
  }, [
    permissionsLoading,
    redirectToAdmin,
    paramCalendarEventId,
    tenant,
    loadAttempt,
  ]);

  const handleApprove = async () => {
    if (paramCalendarEventId) {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        await clientApproveBooking(
          paramCalendarEventId,
          userEmail,
          tenant,
          approvalNote.trim() || undefined,
        );
        setApproved(true);
      } catch (err) {
        if (err instanceof ApprovedWithWarningError) {
          // Approved, but e.g. the calendar title was not updated; do not
          // offer approval again.
          setApproved(true);
          setWarning(err.message);
        } else if (err instanceof NotAnApproverError) {
          setNotApprover(true);
        } else {
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Failed to approve booking.",
          );
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDecline = async () => {
    if (paramCalendarEventId && reason.trim()) {
      setDeclining(true);
      setError(null);
      setWarning(null);
      try {
        await decline(paramCalendarEventId, userEmail, reason.trim(), tenant);
        setDeclined(true);
      } catch (err) {
        if (err instanceof NotAnApproverError) {
          setNotApprover(true);
        } else {
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Failed to decline booking.",
          );
        }
      } finally {
        setDeclining(false);
      }
    }
  };

  if (!paramCalendarEventId) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Booking Approval</h1>
        <p>No calendar event ID provided.</p>
      </div>
    );
  }

  if (permissionsLoading || redirectToAdmin || booking === undefined) {
    return <CenterLoading />;
  }

  if (booking === null) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Booking Approval</h1>
        <p>
          We couldn&apos;t load this booking. The link may be wrong, or
          something went wrong while loading it.
        </p>
        <Button
          onClick={() => {
            setBooking(undefined);
            setLoadAttempt((attempt) => attempt + 1);
          }}
          variant="outlined"
        >
          Try again
        </Button>
      </div>
    );
  }

  const status = getBookingStatus(booking, tenant);
  const busy = loading || declining;
  const done = approved || declined || notApprover;

  return (
    <div style={{ padding: 24 }}>
      <h1>Booking Approval</h1>
      <div>
        <p>Request #{booking.requestNumber}</p>
        <p>Title: {booking.title}</p>
        <p>
          Requested by: {booking.firstName} {booking.lastName} ({booking.email})
        </p>
        <p>Rooms: {booking.roomId}</p>
        <p>Time: {formatBookingTime(booking)}</p>
        <p>Status: {status}</p>
      </div>
      {APPROVABLE_STATUSES.has(status) ? (
        <div>
          <TextField
            label="Note (optional)"
            helperText="Appears in the booking history with your approval."
            variant="outlined"
            fullWidth
            multiline
            rows={2}
            value={approvalNote}
            onChange={e => setApprovalNote(e.target.value)}
            disabled={busy || done}
            inputProps={{ maxLength: MAX_ACTION_NOTE_LENGTH }}
            style={{ marginTop: 8, marginBottom: 16 }}
          />
          <Button
            onClick={() => handleApprove()}
            disabled={busy || done}
            variant="contained"
          >
            {loading
              ? "Approving..."
              : approved
                ? "Approved"
                : "Approve Booking"}
          </Button>
          <div style={{ marginTop: 24 }}>
            <TextField
              label="Reason for declining"
              variant="outlined"
              fullWidth
              multiline
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy || done}
              style={{ marginBottom: 16 }}
            />
            <Button
              onClick={() => handleDecline()}
              disabled={busy || done || !reason.trim()}
              variant="outlined"
              color="error"
            >
              {declining
                ? "Declining..."
                : declined
                  ? "Declined"
                  : "Decline Booking"}
            </Button>
          </div>
          {warning && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {warning}
            </Alert>
          )}
          {notApprover && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {NOT_AN_APPROVER_MESSAGE}
            </Alert>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <p>
          This booking is {status}, so there is nothing to approve or decline.
        </p>
      )}
    </div>
  );
};

const ApprovePage: React.FC = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <ApprovePageContent />
  </Suspense>
);

export default ApprovePage;
