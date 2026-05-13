import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import NavBar from "@/components/src/client/routes/components/navBar";
import SchemaDriftBanner from "@/components/src/client/routes/components/SchemaDriftBanner";
import TenantSiteBanner from "@/components/src/client/routes/components/TenantSiteBanner";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import SchemaProviderWrapper from "@/components/src/client/routes/components/SchemaProviderWrapper";
import TenantEntitlementGuard from "@/components/src/client/routes/components/TenantEntitlementGuard";
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
    if (!tenantSchema?.tenant?.name) {
      return {
        title: "NYU room booking",
        description: "NYU space reservation",
      };
    }
    const title = `${tenantSchema.tenant.name} Booking`;
    const description =
      tenantSchema.tenant.nameForPolicy?.trim() ||
      `${title} — NYU space reservation`;
    return {
      title,
      description,
      ...(tenantSchema.tenant.logo
        ? {
            icons: {
              icon: tenantSchema.tenant.logo,
              apple: tenantSchema.tenant.logo,
            },
          }
        : {}),
    };
  } catch (error) {
    console.error("generateMetadata: Error generating metadata:", error);
    return {
      title: "NYU room booking",
      description: "NYU space reservation",
    };
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
      tenantId: tenantSchema?.tenantId,
      name: tenantSchema?.tenant?.name,
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
      tenantId: tenantSchema.tenantId || tenant,
    };

    console.log("Layout: Serialized tenantSchema:", {
      tenantId: serializedTenantSchema.tenantId,
      name: serializedTenantSchema.tenant.name,
      resourcesCount: serializedTenantSchema.resources?.length || 0,
    });

    return (
      <SchemaProviderWrapper value={serializedTenantSchema}>
        <ClientProvider>
          <SchemaDriftBanner />
          <TenantEntitlementGuard>
            <TenantSiteBanner />
            <NavBar />
            {children}
          </TenantEntitlementGuard>
        </ClientProvider>
      </SchemaProviderWrapper>
    );
  } catch (error) {
    console.error("Layout: Error fetching tenant schema:", error);
    notFound();
  }
};

export default Layout;
