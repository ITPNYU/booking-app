"use client";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import { TenantAccess } from "@/components/src/types";
import React, { useEffect, useState } from "react";

const TENANT_INFO = {
  mc: {
    name: "Media Commons",
    path: "/mc",
  },
  itp: {
    name: "ITP",
    path: "/itp",
  },
};

const HomePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [tenantAccess, setTenantAccess] = useState<TenantAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenantAccess = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        // Extract netId from email (assuming format is netId@nyu.edu)
        const netId = user.email.split("@")[0];

        const response = await fetch(`/api/user-tenant-access?netId=${netId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch tenant access");
        }

        const data: TenantAccess = await response.json();
        setTenantAccess(data);
      } catch (err) {
        console.error("Error fetching tenant access:", err);
        setError("Failed to load tenant access information");
        // Default to showing all tenants on error
        setTenantAccess({ tenants: ["mc", "itp"] });
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchTenantAccess();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const accessibleTenants = tenantAccess?.tenants || [];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold mb-8">NYU Booking System</h1>

      {accessibleTenants.length === 0 ? (
        <div className="text-gray-600">
          No tenant access available for your account.
        </div>
      ) : (
        <div className="space-y-4">
          {accessibleTenants.map(tenant => {
            const info = TENANT_INFO[tenant as keyof typeof TENANT_INFO];
            if (!info) return null;

            return (
              <div key={tenant} className="m-4">
                <a
                  href={info.path}
                  className="text-xl text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {info.name}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {tenantAccess?.userInfo && (
        <div className="mt-8 text-sm text-gray-500">
          <p>
            Department:{" "}
            {tenantAccess.userInfo.mapped_department ||
              tenantAccess.userInfo.dept_name ||
              "N/A"}
          </p>
          <p>School: {tenantAccess.userInfo.school_name || "N/A"}</p>
        </div>
      )}
    </div>
  );
};

export default HomePage;
