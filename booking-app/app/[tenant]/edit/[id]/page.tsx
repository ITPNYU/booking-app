// app/edit/[id].tsx

"use client";

import EditLandingPage from "@/components/src/client/routes/edit/EditLandingPage";
import { useParams } from "next/navigation";
import React from "react";

const HomePage = () => {
  const { id } = useParams<{ id: string }>();
  return <EditLandingPage calendarEventId={id} />;
};

export default HomePage;
