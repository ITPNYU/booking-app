// app/layout.tsx

import "@/components/src/client/styles.css";

import { AuthProvider } from "@/components/src/client/routes/components/AuthProvider";
import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import CssBaseline from "@mui/material/CssBaseline";
import NavBar from "@/components/src/client/routes/components/navBar";
import { Roboto } from "next/font/google";
import { ThemeProvider } from "@mui/material";
import theme from "./theme/theme";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Media commons booking app",
  description: "Media commons booking app",
};

type LayoutProps = {
  children: React.ReactNode;
};

const RootLayout: React.FC<LayoutProps> = ({ children }) => (
  <html lang="en">
    <head></head>
    <body className={roboto.className}>
      <AuthProvider>
        <ClientProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <NavBar />
            {children}
          </ThemeProvider>
        </ClientProvider>
      </AuthProvider>
    </body>
  </html>
);

export default RootLayout;
