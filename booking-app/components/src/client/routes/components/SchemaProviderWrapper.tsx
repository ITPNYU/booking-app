"use client";

import React, { useEffect } from "react";
import { SchemaContextType, SchemaProvider } from "./SchemaProvider";

type SchemaProviderWrapperProps = {
  value: SchemaContextType;
  children: React.ReactNode;
};

const SchemaProviderWrapper: React.FC<SchemaProviderWrapperProps> = ({
  value,
  children,
}) => {
  console.log("SchemaProviderWrapper: Received value (render):", {
    tenant: value?.tenant,
    name: value?.name,
    resourcesCount: value?.resources?.length || 0,
  });

  useEffect(() => {
    console.log("SchemaProviderWrapper: Value after hydration:", {
      tenant: value?.tenant,
      name: value?.name,
      resourcesCount: value?.resources?.length || 0,
    });
  }, [value]);

  return <SchemaProvider value={value}>{children}</SchemaProvider>;
};

export default SchemaProviderWrapper;
