"use client";

import React, { Suspense, useState } from "react";

import { Button } from "@mui/material";
import { approveBooking } from "@/components/src/server/admin";
import { useSearchParams } from "next/navigation";

const ApprovePageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (paramCalendarEventId) {
      setLoading(true);
      setError(null);
      try {
        await approveBooking(paramCalendarEventId);
        setApproved(true);
      } catch (err) {
        setError("Failed to approve booking.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Booking Approval</h1>
      {paramCalendarEventId ? (
        <div>
          <p>Event ID: {paramCalendarEventId}</p>
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
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <p>No calendar event ID provided.</p>
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
