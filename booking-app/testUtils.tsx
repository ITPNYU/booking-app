import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import theme from "./app/theme/theme";

const renderWithTheme = (ui: React.ReactElement, options = {}) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>, options);
};

export * from "@testing-library/react";
export { renderWithTheme as render };
