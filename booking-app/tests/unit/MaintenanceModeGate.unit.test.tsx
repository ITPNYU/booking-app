import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MaintenanceModeGate from "@/components/src/client/routes/components/MaintenanceModeGate";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { PagePermission } from "@/components/src/types";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);

function renderGate(overrides: Record<string, unknown> = {}) {
  const value = {
    adminUsers: [],
    maintenanceMode: {
      enabled: true,
      message: "Requests are paused.",
    },
    pagePermission: PagePermission.BOOKING,
    permissionsLoading: false,
    userEmail: "requester@nyu.edu",
    ...overrides,
  } as any;

  render(
    <DatabaseContext.Provider value={value}>
      <MaintenanceModeGate>
        <div>Protected tenant content</div>
      </MaintenanceModeGate>
    </DatabaseContext.Provider>,
  );

  return value;
}

describe("MaintenanceModeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/mc/book");
  });

  it("renders children when maintenance mode is disabled", () => {
    renderGate({
      maintenanceMode: {
        enabled: false,
        message: "Requests are paused.",
      },
    });

    expect(screen.getByText("Protected tenant content")).toBeInTheDocument();
    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("blocks children and shows only the maintenance notice for non-admins", () => {
    renderGate();

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
    expect(screen.getByText("Requests are paused.")).toBeInTheDocument();
    expect(
      screen.queryByText("Protected tenant content"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /turn off maintenance mode/i }),
    ).not.toBeInTheDocument();
  });

  it("allows database admins to reach the admin page during maintenance mode", () => {
    mockUsePathname.mockReturnValue("/mc/admin");

    renderGate({
      adminUsers: [{ email: "admin@nyu.edu" }],
      pagePermission: PagePermission.ADMIN,
      userEmail: "admin@nyu.edu",
    });

    expect(screen.getByText("Protected tenant content")).toBeInTheDocument();
    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("allows super admins to reach the admin page during maintenance mode", () => {
    mockUsePathname.mockReturnValue("/mc/admin");

    renderGate({
      adminUsers: [],
      pagePermission: PagePermission.SUPER_ADMIN,
      userEmail: "super@nyu.edu",
    });

    expect(screen.getByText("Protected tenant content")).toBeInTheDocument();
    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("blocks admin URLs when the signed-in user is not in adminUsers", () => {
    mockUsePathname.mockReturnValue("/mc/admin");

    renderGate({
      adminUsers: [{ email: "admin@nyu.edu" }],
      pagePermission: PagePermission.ADMIN,
      userEmail: "other@nyu.edu",
    });

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
    expect(
      screen.queryByText("Protected tenant content"),
    ).not.toBeInTheDocument();
  });
});
