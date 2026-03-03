// app/modification/[id].tsx

"use client";

import ModificationLandingPage from "@/components/src/client/routes/modification/ModificationLandingPage";
import React from "react";

const HomePage = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  return <ModificationLandingPage calendarEventId={id} />;
};

export default HomePage;
