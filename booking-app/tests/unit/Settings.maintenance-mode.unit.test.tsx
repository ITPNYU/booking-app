import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Settings from "@/components/src/client/routes/admin/components/Settings";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { PagePermission } from "@/components/src/types";

vi.mock("@/components/src/client/routes/admin/components/AdminUsers", () => ({
  AdminUsers: () => <div>Admin Users</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/Approvers", () => ({
  Approvers: () => <div>Approvers</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/Ban", () => ({
  BannedUsers: () => <div>Ban</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/BookingTypes", () => ({
  default: () => <div>Booking Types</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/Departments", () => ({
  Departments: () => <div>Departments</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/ExportDatabase", () => ({
  default: () => <div>Export</div>,
}));
vi.mock(
  "@/components/src/client/routes/admin/components/MaintenanceModeSettings",
  () => ({
    default: () => <div>Maintenance mode settings</div>,
  }),
);
vi.mock("@/components/src/client/routes/admin/components/PAUsers", () => ({
  PAUsers: () => <div>PA Users</div>,
}));
vi.mock(
  "@/components/src/client/routes/admin/components/PolicySettings",
  () => ({
    default: () => <div>Policy Settings</div>,
  }),
);
vi.mock(
  "@/components/src/client/routes/admin/components/SafetyTraining",
  () => ({
    default: () => <div>Safety Training</div>,
  }),
);
vi.mock("@/components/src/client/routes/admin/components/SyncCalendars", () => ({
  default: () => <div>Sync Calendars</div>,
}));
vi.mock("@/components/src/client/routes/admin/components/PreBan", () => ({
  PreBannedUsers: () => <div>Pre-ban</div>,
}));
vi.mock(
  "@/components/src/client/routes/admin/components/SiteBannerSettings",
  () => ({
    default: () => <div>Site banner</div>,
  }),
);

function renderSettings(pagePermission: PagePermission) {
  render(
    <DatabaseContext.Provider value={{ pagePermission } as any}>
      <Settings />
    </DatabaseContext.Provider>,
  );
}

describe("Settings maintenance mode visibility", () => {
  it("hides the maintenance mode tab from tenant admins", () => {
    renderSettings(PagePermission.ADMIN);

    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("shows the maintenance mode tab to super admins", () => {
    renderSettings(PagePermission.SUPER_ADMIN);

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
  });
});
