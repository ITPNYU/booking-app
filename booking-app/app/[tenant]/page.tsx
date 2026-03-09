// app/[tenant]/page.tsx

"use client";

import { useContext, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import MyBookingsPage from "@/components/src/client/routes/myBookings/myBookingsPage";
import { PagePermission } from "@/components/src/types";
import React from "react";

const FLAG_KEY = "hasRedirectedToDefaultContext";

const PERMISSION_PATHS: Partial<Record<PagePermission, string>> = {
  [PagePermission.SUPER_ADMIN]: "super",
  [PagePermission.ADMIN]: "admin",
  [PagePermission.SERVICES]: "services",
  [PagePermission.LIAISON]: "liaison",
  [PagePermission.PA]: "pa",
};

const HomePage: React.FC = () => {
  const { permissionsLoading, pagePermission } = useContext(DatabaseContext);
  const router = useRouter();
  const { tenant } = useParams<{ tenant: string }>();

  useEffect(() => {
    if (permissionsLoading) return;
    if (!tenant) return;
    if (sessionStorage.getItem(FLAG_KEY) === "true") return;
    const path = PERMISSION_PATHS[pagePermission];
    if (path) {
      sessionStorage.setItem(FLAG_KEY, "true");
      router.replace(`/${tenant}/${path}`);
    }
  }, [permissionsLoading, pagePermission, tenant, router]);

  // Render nothing while loading or while a redirect is about to fire.
  if (permissionsLoading) return null;
  const hasChosen =
    typeof window !== "undefined" &&
    sessionStorage.getItem(FLAG_KEY) === "true";
  if (pagePermission !== PagePermission.BOOKING && !hasChosen) return null;

  return <MyBookingsPage />;
};

export default HomePage;
