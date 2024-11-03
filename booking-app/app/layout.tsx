// app/layout.tsx

import "@/components/src/client/styles.css";

import { AuthProvider } from "@/components/src/client/providers/AuthProvider";
import CssBaseline from "@mui/material/CssBaseline";
import { Roboto } from "next/font/google";
import { ThemeProvider } from "@mui/material";
import theme from "./theme/theme";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "NYU Booking Tool",
  description: "NYU Booking Tool",
};

type LayoutProps = {
  children: React.ReactNode;
};

const RootLayout: React.FC<LayoutProps> = ({ children }) => (
  <html lang="en">
    <head></head>
    <body className={roboto.className}>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AuthProvider>
    </body>
  </html>
);

export default RootLayout;
