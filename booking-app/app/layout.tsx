// app/layout.tsx

import "@/components/src/client/styles.css";
import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";

import { ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { SessionProvider } from "@/components/src/client/routes/components/SessionProvider";
import { AuthProvider } from "@/components/src/client/routes/components/AuthProvider";
import theme from "./theme/theme";

export const metadata = {
  title: "NYU room booking",
  description: "NYU space reservation",
};

type LayoutProps = {
  children: React.ReactNode;
};

const RootLayout: React.FC<LayoutProps> = ({ children }) => (
  <html lang="en">
    <head></head>
    <body>
      <SessionProvider>
        <AuthProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </SessionProvider>
    </body>
  </html>
);

export default RootLayout;
