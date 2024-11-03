// app/media-commons/layout.tsx

import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import NavBar from "@/components/src/client/routes/components/navBar/NavBar";

export const metadata = {
  title: "Media commons booking app",
  description: "Media commons booking app",
};

type LayoutProps = {
  children: React.ReactNode;
};

const MediaCommonsLayout: React.FC<LayoutProps> = ({ children }) => (
  <ClientProvider>
    <NavBar />
    {children}
  </ClientProvider>
);

export default MediaCommonsLayout;
