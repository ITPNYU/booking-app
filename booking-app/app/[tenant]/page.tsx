// app/[tenant]/page.tsx

"use client";

import { useContext, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import { PagePermission } from "@/components/src/types";
import { PERMISSION_PATH } from "@/components/src/utils/permissions";
import React from "react";

const FLAG_KEY = "hasRedirectedToDefaultContext";

const HomePage: React.FC = () => {
  const { permissionsLoading, pagePermission } = useContext(DatabaseContext);
  const router = useRouter();
  const { tenant } = useParams<{ tenant: string }>();

  useEffect(() => {
    if (permissionsLoading) return;
    if (!tenant) return;
    if (sessionStorage.getItem(FLAG_KEY) === "true") return;
    const path = PERMISSION_PATH[pagePermission];
    if (path) {
      sessionStorage.setItem(FLAG_KEY, "true");
      router.replace(`/${tenant}/${path}`);
    }
  }, [permissionsLoading, pagePermission, tenant, router]);

  // Show MyBookingsPage immediately (optimistic: most users are BOOKING).
  // Admin/PA users will be redirected once permissions resolve.
  const hasChosen =
    typeof window !== "undefined" &&
    sessionStorage.getItem(FLAG_KEY) === "true";
  if (
    !permissionsLoading &&
    pagePermission !== PagePermission.BOOKING &&
    !hasChosen
  )
    return null;

  return <MyBookingsPage />;
};

export default HomePage;
