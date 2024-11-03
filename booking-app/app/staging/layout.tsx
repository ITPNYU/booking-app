// app/staging/layout.tsx

import ClientProvider from "@/components/src/client/providers/ClientProvider";
import NavBar from "@/components/src/client/routes/components/navBar/NavBar";
import { StagingDatabaseProvider } from "@/components/src/client/providers/StagingDatabaseProvider";

export const metadata = {
  title: "ITP Staging Space booking tool",
  description: "ITP Staging Space booking tool",
};

type LayoutProps = {
  children: React.ReactNode;
};

const MediaCommonsLayout: React.FC<LayoutProps> = ({ children }) => (
  <ClientProvider>
    <StagingDatabaseProvider>
      <NavBar />
      {children}
    </StagingDatabaseProvider>
  </ClientProvider>
);

export default MediaCommonsLayout;
