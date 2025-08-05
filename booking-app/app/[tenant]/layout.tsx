import React from "react";
import { notFound } from "next/navigation";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import SchemaProviderWrapper from "@/components/src/client/routes/components/SchemaProviderWrapper";
import NavBar from "@/components/src/client/routes/components/navBar";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const ALLOWED_PLATFORMS = ["mc", "itp"];

const Layout: React.FC<LayoutProps> = async ({ children, params }) => {
  if (!ALLOWED_PLATFORMS.includes(params.tenant)) {
    notFound();
  }

  try {
    const tenantSchema = await serverGetDocumentById<SchemaContextType>(
      TableNames.TENANT_SCHEMA,
      params.tenant
    );

    if (!tenantSchema) {
      notFound();
    }

    return (
      <SchemaProviderWrapper value={tenantSchema}>
        <NavBar />
        {children}
      </SchemaProviderWrapper>
    );
  } catch (error) {
    console.error("Error fetching tenant schema:", error);
    notFound();
  }
};

export default Layout;
