import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    custom: {
      [key: string]: string;
    };
  }

  interface PaletteOptions {
    custom?: {
      [key: string]: string;
    };
  }
}
