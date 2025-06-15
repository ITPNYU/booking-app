"use client";

import React from "react";
import { notFound } from "next/navigation";
import { SchemaProvider } from "@/components/src/client/routes/components/SchemaProvider";
import { schema } from "./schema";

type LayoutProps = {
  children: React.ReactNode;
  params: {
    tenant: string;
  };
};

const ALLOWED_PLATFORMS = ["mc", "itp"];

const Layout: React.FC<LayoutProps> = ({ children, params }) => {
  if (!ALLOWED_PLATFORMS.includes(params.tenant)) {
    return notFound();
  }
  const tenantSchema = schema[params.tenant];
  return <SchemaProvider value={tenantSchema}>{children}</SchemaProvider>;
};

export default Layout;
