import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CalendarEventBlock from "@/components/src/client/routes/booking/components/CalendarEventBlock";
import { PagePermission } from "@/components/src/types";

const eventInfo = (title: string) =>
  ({
    event: {
      title,
      url: "0:1",
    },
  }) as any;

describe("CalendarEventBlock permission display", () => {
  it("hides existing event titles from booking users", () => {
    render(
      CalendarEventBlock(eventInfo("Private meeting"), PagePermission.BOOKING),
    );

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Private meeting")).not.toBeInTheDocument();
  });

  it.each([
    PagePermission.PA,
    PagePermission.LIAISON,
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ])("shows existing event titles to %s users", (pagePermission) => {
    render(CalendarEventBlock(eventInfo("Private meeting"), pagePermission));

    expect(screen.getByText("Private meeting")).toBeInTheDocument();
  });
});
