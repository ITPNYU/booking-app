import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import NavBar from "@/components/src/client/routes/components/navBar";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import SchemaProviderWrapper from "@/components/src/client/routes/components/SchemaProviderWrapper";
import { ALLOWED_TENANTS } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { notFound } from "next/navigation";
import React from "react";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const Layout: React.FC<LayoutProps> = async ({ children, params }) => {
  if (!ALLOWED_TENANTS.includes(params.tenant as any)) {
    notFound();
  }

  try {
    console.log("Layout: Fetching schema for tenant:", params.tenant);
    const tenantSchema = await serverGetDocumentById<SchemaContextType>(
      TableNames.TENANT_SCHEMA,
      params.tenant,
    );
    console.log("Layout: Retrieved tenantSchema:", {
      tenant: tenantSchema?.tenant,
      name: tenantSchema?.name,
      resourcesCount: tenantSchema?.resources?.length || 0,
    });

    if (!tenantSchema) {
      console.error("Layout: No tenant schema found for:", params.tenant);
      notFound();
    }

    console.log("Layout: Passing tenantSchema to SchemaProviderWrapper");

    // Ensure the data is properly serializable
    const serializedTenantSchema: SchemaContextType = {
      ...tenantSchema,
      tenant: tenantSchema.tenant || params.tenant, // Fallback to params.tenant
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
