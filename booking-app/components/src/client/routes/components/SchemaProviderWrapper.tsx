"use client";

import React from "react";
import { SchemaProvider, SchemaContextType } from "./SchemaProvider";

type SchemaProviderWrapperProps = {
  value: SchemaContextType;
  children: React.ReactNode;
};

const SchemaProviderWrapper: React.FC<SchemaProviderWrapperProps> = ({ value, children }) => {
  return <SchemaProvider value={value}>{children}</SchemaProvider>;
};

export default SchemaProviderWrapper; 