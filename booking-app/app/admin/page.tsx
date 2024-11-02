// app/admin/page.tsx

"use client";

import Admin from "@/components/src/client/routes/admin/components/Admin";
import { useSearchParams } from "next/navigation";

const AdminPage: React.FC = () => {
  const searchParams = useSearchParams();
  const calendarEventId = searchParams.get("calendarEventId");

  return <Admin calendarEventId={calendarEventId} />;
};

export default AdminPage;
