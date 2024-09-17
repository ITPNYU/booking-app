"use client";

import React, { Suspense, useState } from "react";

import { Button } from "@mui/material";
import { useSearchParams } from "next/navigation";
import { decline } from "@/components/src/server/db";

const DeclinePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  const [loading, setLoading] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecline = async () => {
    if (paramCalendarEventId) {
      setLoading(true);
      setError(null);
      try {
        await decline(paramCalendarEventId);
        setDeclined(true);
      } catch (err) {
        setError("Failed to decline booking.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Booking Decline</h1>
      {paramCalendarEventId ? (
        <div>
          <p>Event ID: {paramCalendarEventId}</p>
          <Button
            onClick={() => handleDecline()}
            disabled={loading || declined}
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
  <Suspense fallback={<div>Loading...</div>}>
    <DeclinePageContent />
  </Suspense>
);

export default DeclinePage;
