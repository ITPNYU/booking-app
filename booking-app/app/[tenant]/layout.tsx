import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import NavBar from "@/components/src/client/routes/components/navBar";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import SchemaProviderWrapper from "@/components/src/client/routes/components/SchemaProviderWrapper";
import { ALLOWED_TENANTS } from "@/components/src/constants/tenants";
import { getCachedTenantSchema } from "@/lib/tenant/getCachedTenantSchema";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    tenant: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant } = await params;
  try {
    const tenantSchema = await getCachedTenantSchema(tenant);
    if (!tenantSchema?.name) {
      notFound();
    }
    const title = `${tenantSchema.name} Booking`;
    const description =
      tenantSchema.nameForPolicy?.trim() ||
      `${title} — NYU space reservation`;
    return {
      title,
      description,
      ...(tenantSchema.logo
        ? {
            icons: {
              icon: tenantSchema.logo,
              apple: tenantSchema.logo,
            },
          }
        : {}),
    };
  } catch (error) {
    console.error("generateMetadata: Error generating metadata:", error);
    throw error;
  }
}

const Layout: React.FC<LayoutProps> = async ({ children, params }) => {
  const { tenant } = await params;
  if (!ALLOWED_TENANTS.includes(tenant as any)) {
    notFound();
  }

  try {
    console.log("Layout: Fetching schema for tenant:", tenant);
    const tenantSchema = await getCachedTenantSchema(tenant);

    console.log("Layout: Retrieved tenantSchema:", {
      tenant: tenantSchema?.tenant,
      name: tenantSchema?.name,
      resourcesCount: tenantSchema?.resources?.length || 0,
    });

    if (!tenantSchema) {
      console.error("Layout: No tenant schema found for:", tenant);
      notFound();
    }

    console.log("Layout: Passing tenantSchema to SchemaProviderWrapper");

    const resources =
      tenantSchema.resources && Array.isArray(tenantSchema.resources)
        ? applyEnvironmentCalendarIds(tenantSchema.resources)
        : tenantSchema.resources;

    const serializedTenantSchema: SchemaContextType = {
      ...tenantSchema,
      resources: resources ?? tenantSchema.resources,
      tenant: tenantSchema.tenant || tenant,
    };

    console.log("Layout: Serialized tenantSchema:", {
      tenant: serializedTenantSchema.tenant,
      name: serializedTenantSchema.name,
      resourcesCount: serializedTenantSchema.resources?.length || 0,
    });

    return (
      <SchemaProviderWrapper value={serializedTenantSchema}>
        <ClientProvider>
          <NavBar />
          {children}
        </ClientProvider>
      </SchemaProviderWrapper>
    );
  } catch (error) {
    console.error("Layout: Error fetching tenant schema:", error);
    notFound();
  }
};

export default Layout;
