"use client";

import PAPage from "@/components/src/client/routes/pa/PAPage";
import React, { Suspense } from "react";

const PA: React.FC = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <PAPage />
  </Suspense>
);

export default PA;
