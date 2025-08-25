"use client";
import {
  DatabaseContext,
  DatabaseProvider,
} from "@/components/src/client/routes/components/Provider";
import { decline } from "@/components/src/server/db";
import { Button, TextField } from "@mui/material";
import { useParams, useSearchParams } from "next/navigation";
import React, { Suspense, useContext, useState } from "react";

const DeclinePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const { tenant } = useParams();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  const [loading, setLoading] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { userEmail } = useContext(DatabaseContext);

  const handleDecline = async () => {
    if (paramCalendarEventId && reason.trim()) {
      setLoading(true);
      setError(null);
      try {
        await decline(
          paramCalendarEventId,
          userEmail,
          reason,
          tenant as string,
        );
        setDeclined(true);
      } catch (err) {
        setError("Failed to decline booking.");
        console.log(err);
      } finally {
        setLoading(false);
      }
    } else {
      setError("Please provide a reason for declining.");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Booking Decline</h1>
      {paramCalendarEventId ? (
        <div>
          <p>Event ID: {paramCalendarEventId}</p>
          <TextField
            label="Reason for Declining"
            variant="outlined"
            fullWidth
            multiline
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ marginBottom: 16 }}
            required
          />
          <Button
            onClick={() => handleDecline()}
            disabled={loading || declined || !reason.trim()}
            variant="contained"
          >
            {loading
              ? "Declining..."
              : declined
                ? "Declined"
                : "Decline Booking"}
          </Button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <p>No calendar event ID provided.</p>
      )}
    </div>
  );
};

const DeclinePage: React.FC = () => (
  <DatabaseProvider>
    <Suspense fallback={<div>Loading...</div>}>
      <DeclinePageContent />
    </Suspense>
  </DatabaseProvider>
);

export default DeclinePage;
