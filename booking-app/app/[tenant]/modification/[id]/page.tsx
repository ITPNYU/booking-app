// app/modification/[id].tsx

"use client";

import ModificationLandingPage from "@/components/src/client/routes/modification/ModificationLandingPage";
import React from "react";

const HomePage: React.FC = ({ params }: { params: { id: string } }) => (
  <ModificationLandingPage calendarEventId={params.id} />
);

export default HomePage;
