"use client";

import React, { Suspense, useContext, useState } from "react";

import {
  DatabaseContext,
  DatabaseProvider,
} from "@/components/src/client/routes/components/Provider";

import { Button, TextField } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { clientApproveBooking } from "@/components/src/server/db";
import { decline } from "@/components/src/server/db";

const ApproveDeclinePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  const [loading, setLoading] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [notApproved, setNotApproved] = useState(false);
  const [notDeclined, setNotDeclined] = useState(false);
  const [reason, setReason] = useState("");
  const { userEmail } = useContext(DatabaseContext);

  const handleApprove = async () => {
    if (paramCalendarEventId) {
      setNotDeclined(true);
      setLoading(true);
      setError(null);
      try {
        await clientApproveBooking(paramCalendarEventId, userEmail);
        setApproved(true);
        setNotApproved(false);
      } catch (err) {
        setError("Failed to approve booking.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDecline = async () => {
    if (paramCalendarEventId && reason.trim()) {
      setNotApproved(true);
      setLoading(true);
      setError(null);
      try {
        await decline(paramCalendarEventId, userEmail, reason);
        setDeclined(true);
        setNotDeclined(false);
      } catch (err) {
        setError("Failed to decline booking.");
      } finally {
        setLoading(false);
      }
    } else {
      setError("Please provide a reason for declining.");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Booking Approve/Decline</h1>
      {paramCalendarEventId ? (
        <div>
          <p>Event ID: {paramCalendarEventId}</p>
          <p>Email: {userEmail}</p>
          {!(notApproved) && (
            <Button
              onClick={() => handleApprove()}
              disabled={loading || approved}
              variant="contained"
            >
              {loading
                ? "Approving..."
                : approved
                  ? "Approved"
                  : "Approve Booking"}
            </Button>
          )}
          {!(notDeclined) && (
            <Button
              onClick={() => handleDecline()}
              disabled={loading || declined || notDeclined}
              variant="contained"
              style={{marginLeft: declined ? "0px" : "24px"  }}
            >
              {loading
                ? "Declining..."
                : declined
                  ? "Declined"
                  : "Decline Booking"}
            </Button>
          )}
          {!(notDeclined) && (
          <TextField
            label="Reason for Declining"
            variant="outlined"
            multiline
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ marginLeft: 24, marginBottom: 16, width: 400}}
            required
          />
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <p>No calendar event ID provided.</p>
      )}
    </div>
  );
};

const ApproveDeclinePage: React.FC = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <ApproveDeclinePageContent />
  </Suspense>
);

export default ApproveDeclinePage;

