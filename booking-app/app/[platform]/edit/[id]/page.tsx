// app/edit/[id].tsx

"use client";

import EditLandingPage from "@/components/src/client/routes/edit/EditLandingPage";
import React from "react";

const HomePage: React.FC = ({ params }: { params: { id: string } }) => (
  <EditLandingPage calendarEventId={params.id} />
);

export default HomePage;
