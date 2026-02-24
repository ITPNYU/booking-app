// app/modification/[id].tsx

"use client";

import ModificationLandingPage from "@/components/src/client/routes/modification/ModificationLandingPage";
import React, { use } from "react";

const HomePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return <ModificationLandingPage calendarEventId={id} />;
};

export default HomePage;
