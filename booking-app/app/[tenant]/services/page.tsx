// app/services/page.tsx

"use client";

import Services from "@/components/src/client/routes/services/Services";
import { Suspense } from "react";

const ServicesPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Services />
    </Suspense>
  );
};

export default ServicesPage;
