// app/edit/[id].tsx

"use client";

import EditLandingPage from "@/components/src/client/routes/edit/EditLandingPage";
import React, { use } from "react";

const HomePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  return <EditLandingPage calendarEventId={id} />;
};

export default HomePage;
