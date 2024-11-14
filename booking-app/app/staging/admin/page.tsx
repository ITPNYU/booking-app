// app/staging/admin/page.tsx

"use client";

import Admin from "@/components/src/client/routes/admin/components/Admin";
import { Suspense } from "react";
import { Tenants } from "@/components/src/policy";
import { useSearchParams } from "next/navigation";

const AdminWithParams: React.FC = () => {
  const searchParams = useSearchParams();
  const calendarEventId = searchParams.get("calendarEventId");

  return <Admin calendarEventId={calendarEventId} tenant={Tenants.STAGING} />;
};

const AdminPage: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminWithParams />
    </Suspense>
  );
};

export default AdminPage;
