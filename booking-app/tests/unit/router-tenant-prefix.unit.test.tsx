import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import EditLandingPage from "@/components/src/client/routes/edit/EditLandingPage";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

const mockPush = vi.fn();

const theme = createTheme({
  palette: {
    custom: {
      border: "#ccc",
      gray: "#f5f5f5",
    },
  } as any,
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  } as any);
});

describe("EditLandingPage – tenant prefix in router.push", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ tenant: "media-commons" });
  });

  it("navigates to /{tenant}/edit/role/{id} when Start is clicked", async () => {
    render(<EditLandingPage calendarEventId="evt-123" />, {
      wrapper: Wrapper,
    });
    const startButton = screen.getByRole("button", { name: /start/i });
    fireEvent.click(startButton);

    expect(mockPush).toHaveBeenCalledWith(
      "/media-commons/edit/role/evt-123",
    );
  });
});
