"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { reject } from "@/components/src/server";

const RejectPage: React.FC = () => {
  const searchParams = useSearchParams();
  const paramCalendarEventId = searchParams.get("calendarEventId");
  useEffect(() => {
    if (paramCalendarEventId) {
      reject(paramCalendarEventId);
    }
  }, [paramCalendarEventId]);

  return (
    <div>
      <h1>Booking Approval</h1>
      {paramCalendarEventId ? (
        <p>Rejecting booking for event ID: {paramCalendarEventId}</p>
      ) : (
        <p>No calendar event ID provided.</p>
      )}
    </div>
  );
};

export default RejectPage;