import { createContext, useContext } from "react";

export type Agreement = {
  id: string;
  html: string;
};

export type Resource = {
  capacity: number;
  name: string;
  roomId: number;
  autoApproval: boolean;
  checkable: boolean;
};

export type SchemaContextType = {
  tenant: string;
  name: string;
  logo: string;
  nameForPolicy: string;
  policy: string; // innerHTML
  programMapping: Record<string, string[]>;
  roles: string[];
  roleMapping: Record<string, string[]>;
  showNNumber: boolean;
  showSponsor: boolean;
  showHireSecurity: boolean;
  agreements: Agreement[]; // innerHTML[]
  resources: Resource[];
  supportVIP: boolean;
  supportWalkIn: boolean;
  resourceName: string;
};

export const SchemaContext = createContext<SchemaContextType>({
  tenant: "",
  name: "",
  logo: "",
  nameForPolicy: "",
  policy: "",
  roles: [],
  showNNumber: true,
  showSponsor: true,
  showHireSecurity: true,
  agreements: [],
  resources: [],
  supportVIP: false,
  supportWalkIn: false,
  resourceName: "",
  programMapping: {},
  roleMapping: {},
});

export const useTenantSchema = () => useContext(SchemaContext);

export const SchemaProvider: React.FC<{
  value: SchemaContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
};
