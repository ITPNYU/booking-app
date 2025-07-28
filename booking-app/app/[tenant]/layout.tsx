"use client";

import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { isValidTenant } from "@/components/src/client/routes/hooks/useTenant";
import { notFound } from "next/navigation";
import React from "react";
import { schema } from "./schema";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const Layout: React.FC<LayoutProps> = ({ children, params }) => {
  // Use the shared validation logic
  if (!isValidTenant(params.tenant)) {
    return notFound();
  }

  const tenantSchema = schema[params.tenant];
  return <SchemaProvider value={tenantSchema}>{children}</SchemaProvider>;
};

export default Layout;
