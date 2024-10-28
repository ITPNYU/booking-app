"use client";

import { deepPurple, lightGreen } from "@mui/material/colors";

import { Roboto } from "next/font/google";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: deepPurple.A700,
      50: "#F2E7FE",
    },
    secondary: {
      main: deepPurple.A100,
      light: deepPurple[50],
    },
    custom: {
      gray: "rgba(33, 33, 33, 0.08)",
      gray2: "rgba(0,0,0,0.6)",
      gray3: "rgba(0,0,0,0.3)",
      border: "#e3e3e3",
    },
    success: { main: lightGreen.A400 },
    warning: { main: "rgb(255 167 0)" },
    error: { main: "rgba(255, 26, 26, 1)" },
  },
  typography: {
    allVariants: {
      fontFamily: "unset",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "a:not(.navbar-brand > a):not(.nav-link)": {
          color: deepPurple.A700,
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        },

        table: {
          border: "1px solid #e3e3e3",
        },
      },
    },
  },
});

export default theme;
