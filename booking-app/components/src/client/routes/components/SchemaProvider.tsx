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
};

export type SchemaContextType = {
  name: string;
  logo: string;
  nameForPolicy: string;
  policy: string; // innerHTML
  programs: string[];
  roles: string[];
  showNNumber: boolean;
  showSponsor: boolean;
  showHireSecurity: boolean;
  agreements: Agreement[]; // innerHTML[]
  resources: Resource[];
};

export const SchemaContext = createContext<SchemaContextType>({
  name: "",
  logo: "",
  nameForPolicy: "",
  policy: "",
  programs: [],
  roles: [],
  showNNumber: true,
  showSponsor: true,
  showHireSecurity: true,
  agreements: [],
  resources: [],
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
