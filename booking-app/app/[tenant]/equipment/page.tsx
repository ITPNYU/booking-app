// app/liaison/page.tsx

"use client";

import Equipment from "@/components/src/client/routes/equipment/Equipment";
import { Suspense } from "react";

const EquipmentPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Equipment />
    </Suspense>
  );
};

export default EquipmentPage;
