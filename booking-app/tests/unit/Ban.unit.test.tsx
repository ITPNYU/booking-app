import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { BannedUsers } from "@/components/src/client/routes/admin/components/Ban";
import { addBanWindow } from "@/components/src/utils/banWindow";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
}));

vi.mock("@/lib/firebase/firebase", () => ({
  clientSaveDataToFirestore: (...args: unknown[]) => mocks.save(...args),
  clientDeleteDataFromFirestore: vi.fn(),
}));

const theme = createTheme();

const renderBan = (
  bannedUsers: Array<Record<string, unknown>> = [],
) => {
  const reloadBannedUsers = vi.fn().mockResolvedValue(undefined);
  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider
        value={{ bannedUsers, reloadBannedUsers } as any}
      >
        <BannedUsers />
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
  return { reloadBannedUsers };
};

describe("BannedUsers", () => {
  beforeEach(() => {
    mocks.save.mockReset();
    mocks.save.mockResolvedValue(undefined);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("lists a timed ban as active and a dateless ban as permanent", () => {
    renderBan([
      {
        id: "perm",
        email: "forever@nyu.edu",
        bannedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "temp",
        email: "week@nyu.edu",
        bannedAt: "2026-06-01T00:00:00.000Z",
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    ]);

    expect(screen.getByText("forever@nyu.edu")).toBeInTheDocument();
    expect(screen.getByText("Permanent")).toBeInTheDocument();
    expect(screen.getByText("week@nyu.edu")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows column headers and an empty state when nobody is banned", () => {
    renderBan();

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
    expect(screen.getByText("No banned users")).toBeInTheDocument();
  });

  it("moves the end time one week forward when the start changes", () => {
    renderBan();
    fireEvent.change(screen.getByLabelText("Ban start"), {
      target: { value: "2026-06-01T10:00" },
    });
    expect(screen.getByLabelText("Ban end")).toHaveValue(
      addBanWindow("2026-06-01T10:00"),
    );
  });

  it("saves a timed ban with a start and end", async () => {
    const { reloadBannedUsers } = renderBan();
    fireEvent.change(screen.getByLabelText("Temporary ban email"), {
      target: { value: "week@nyu.edu" },
    });
    fireEvent.change(screen.getByLabelText("Ban start"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ban until end" }));

    expect(mocks.save).toHaveBeenCalledWith(
      "usersBanned",
      expect.objectContaining({
        email: "week@nyu.edu",
        startsAt: { __ts: expect.any(Number) },
        endsAt: { __ts: expect.any(Number) },
      }),
    );
    const saved = mocks.save.mock.calls[0][1] as {
      startsAt: { __ts: number };
      endsAt: { __ts: number };
    };
    expect(saved.endsAt.__ts - saved.startsAt.__ts).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    await vi.waitFor(() => expect(reloadBannedUsers).toHaveBeenCalled());
  });
});
