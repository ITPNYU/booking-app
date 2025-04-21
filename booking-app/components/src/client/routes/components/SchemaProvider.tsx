import { createContext, useContext } from "react";

export type Agreement = {
  id: string;
  html: string;
};
export type SchemaContextType = {
  showNNumber: boolean;
  showSponsor: boolean;
  showHireSecurity: boolean;
  agreements?: Agreement[];
};

export const SchemaContext = createContext<SchemaContextType>({
  showNNumber: true,
  showSponsor: true,
  showHireSecurity: true,
  agreements: [],
});

export const useSchema = () => useContext(SchemaContext);

export const SchemaProvider: React.FC<{
  value: SchemaContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
};
