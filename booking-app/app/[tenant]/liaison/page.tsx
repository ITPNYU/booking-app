// app/liaison/page.tsx

"use client";

import Liaison from "@/components/src/client/routes/liaison/Liaison";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const LiaisonWithParams: React.FC = () => {
  const searchParams = useSearchParams();
  const calendarEventId = searchParams.get("calendarEventId");

  return <Liaison calendarEventId={calendarEventId} />;
};

const LiaisonPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LiaisonWithParams />
    </Suspense>
  );
};

export default LiaisonPage;
