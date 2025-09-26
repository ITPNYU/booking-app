// app/staffing/page.tsx

"use client";

import Staffing from "@/components/src/client/routes/staffing/Staffing";
import { Suspense } from "react";

const StaffingPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Staffing />
    </Suspense>
  );
};

export default StaffingPage;
