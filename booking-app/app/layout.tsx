// app/layout.tsx

import "@/components/src/client/styles.css";

import ClientProvider from "@/components/src/client/routes/components/ClientProvider";
import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { Roboto } from "next/font/google";
import theme from "./theme/theme";
import { AuthProvider } from "@/components/src/client/routes/components/AuthProvider";

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
            {children}
          </ThemeProvider>
        </ClientProvider>
      </AuthProvider>
    </body>
  </html>
);

export default RootLayout;
