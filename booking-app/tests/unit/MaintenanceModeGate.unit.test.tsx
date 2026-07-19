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

  it("allows the signin page to mount while permissions are loading", () => {
    mockUsePathname.mockReturnValue("/mc/signin");

    renderGate({
      permissionsLoading: true,
      userEmail: null,
    });

    expect(screen.getByText("Protected tenant content")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps booking routes in loading state while permissions are loading", () => {
    renderGate({
      permissionsLoading: true,
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.queryByText("Protected tenant content"),
    ).not.toBeInTheDocument();
  });

  it("blocks tenant content and shows only the maintenance notice", () => {
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

  it.each(["", "book", "walk-in", "vip", "admin", "pa", "liaison", "services"])(
    "blocks the %s route during maintenance mode",
    (routeSegment) => {
      mockUsePathname.mockReturnValue(
        routeSegment ? `/mc/${routeSegment}` : "/mc",
      );

      renderGate();

      expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
      expect(
        screen.queryByText("Protected tenant content"),
      ).not.toBeInTheDocument();
    },
  );

  it("blocks the admin page during maintenance mode", () => {
    mockUsePathname.mockReturnValue("/mc/admin");

    renderGate({
      adminUsers: [{ email: "admin@nyu.edu" }],
      pagePermission: PagePermission.ADMIN,
      userEmail: "admin@nyu.edu",
    });

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
    expect(
      screen.queryByText("Protected tenant content"),
    ).not.toBeInTheDocument();
  });

  it("allows super admins to reach the super page during maintenance mode", () => {
    mockUsePathname.mockReturnValue("/mc/super");

    renderGate({
      adminUsers: [],
      pagePermission: PagePermission.SUPER_ADMIN,
      userEmail: "super@nyu.edu",
    });

    expect(screen.getByText("Protected tenant content")).toBeInTheDocument();
    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("blocks super admins from non-super pages during maintenance mode", () => {
    mockUsePathname.mockReturnValue("/mc/admin");

    renderGate({
      pagePermission: PagePermission.SUPER_ADMIN,
      userEmail: "super@nyu.edu",
    });

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
    expect(
      screen.queryByText("Protected tenant content"),
    ).not.toBeInTheDocument();
  });
});
