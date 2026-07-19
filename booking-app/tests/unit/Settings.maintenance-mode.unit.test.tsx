import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminSettings from "@/components/src/client/routes/admin/components/Settings";
import SuperSettings from "@/components/src/client/routes/super/settings";

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

vi.mock("@/components/src/client/routes/components/EmailListTable", () => ({
  default: () => <div>Super Admin Users</div>,
}));

describe("Settings maintenance mode visibility", () => {
  it("does not show maintenance mode in tenant admin settings", () => {
    render(<AdminSettings />);

    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });

  it("shows maintenance mode in super admin settings", () => {
    render(<SuperSettings />);

    expect(screen.getByText("Maintenance mode")).toBeInTheDocument();
  });
});
