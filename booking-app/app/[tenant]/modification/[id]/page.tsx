// app/modification/[id].tsx

"use client";

import ModificationLandingPage from "@/components/src/client/routes/modification/ModificationLandingPage";
import { useParams } from "next/navigation";
import React from "react";

const HomePage = () => {
  const { id } = useParams<{ id: string }>();
  return <ModificationLandingPage calendarEventId={id} />;
};

export default HomePage;
