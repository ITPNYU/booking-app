"use client";

import { createContext, useContext } from "react";
import {
  generateDefaultSchema,
  type SchemaContextType,
} from "./schemaTypes";

// Re-export all server-safe schema types/defaults so existing client consumers
// can keep importing them from SchemaProvider. The actual definitions live in
// `./schemaTypes` (no React), which lets server code import them without
// dragging this client-only module into the server bundle.
export * from "./schemaTypes";

export const SchemaContext = createContext<SchemaContextType>(
  generateDefaultSchema(""),
);

export const useTenantSchema = () => useContext(SchemaContext);

export const SchemaProvider: React.FC<{
  value: SchemaContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
};
