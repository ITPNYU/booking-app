// app/edit/[id].tsx

"use client";

import EditLandingPage from "@/components/src/client/routes/edit/EditLandingPage";
import React from "react";

const HomePage = ({ params }: { params: { id: string } }) => {
  const { id } = params;
  return <EditLandingPage calendarEventId={id} />;
};

export default HomePage;
