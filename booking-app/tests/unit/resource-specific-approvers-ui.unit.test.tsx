import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceSpecific } from "@/components/src/client/routes/admin/components/ResourceSpecific";
import {
  defaultResource,
  generateDefaultSchema,
  SchemaProvider,
} from "@/components/src/client/routes/components/SchemaProvider";
import { toApproversResource } from "@/components/src/utils/approversResources";
import {
  clientListApproversResources,
  clientUpdateApproversResource,
} from "@/lib/firebase/firebase";

vi.mock("@/lib/firebase/firebase", () => ({
  clientListApproversResources: vi.fn(),
  clientUpdateApproversResource: vi.fn(),
}));

const listApproversMock = vi.mocked(clientListApproversResources);
const updateApproversMock = vi.mocked(clientUpdateApproversResource);

describe("ResourceSpecific", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    listApproversMock.mockResolvedValue([]);
    updateApproversMock.mockResolvedValue();
  });

  it("adds a validated, normalized approver for an opaque resource ID", async () => {
    const user = userEvent.setup();
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Audio Studio",
        resourceId: "studio/a:floor-2",
        services: ["equipment"],
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    expect(
      await screen.findByText("studio/a:floor-2 Audio Studio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Resource Approvers")).toBeInTheDocument();
    expect(screen.getByText("Service Approvers")).toBeInTheDocument();

    const input = screen.getByLabelText(
      "Resource approver email for studio/a:floor-2",
    );
    await user.type(input, " Person@NYU.EDU ");
    await user.click(
      screen.getByRole("button", {
        name: "Add resource approver for studio/a:floor-2",
      }),
    );

    await waitFor(() =>
      expect(updateApproversMock).toHaveBeenCalledWith(
        "studio/a:floor-2",
        { action: "add", kind: "resource", email: "person@nyu.edu" },
        "tenant-one",
      ),
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/nyu/identity/person", {
      headers: { "x-tenant": "tenant-one" },
    });
  });

  it("adds a service approver for a resource and service", async () => {
    const user = userEvent.setup();
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Audio Studio",
        resourceId: "studio/a:floor-2",
        services: ["equipment"],
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    const input = await screen.findByLabelText(
      "Service approver email for studio/a:floor-2",
    );
    await user.type(input, " Service@NYU.EDU ");
    await user.click(
      screen.getByRole("button", {
        name: "Add service approver for studio/a:floor-2",
      }),
    );

    await waitFor(() =>
      expect(updateApproversMock).toHaveBeenCalledWith(
        "studio/a:floor-2",
        {
          action: "add",
          kind: "service",
          service: "equipment",
          email: "service@nyu.edu",
        },
        "tenant-one",
      ),
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/nyu/identity/service", {
      headers: { "x-tenant": "tenant-one" },
    });
  });

  it("does not add a service approver when NYU Identity validation fails", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
    })) as unknown as typeof fetch;
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Audio Studio",
        resourceId: "studio/a:floor-2",
        services: ["equipment"],
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    const input = await screen.findByLabelText(
      "Service approver email for studio/a:floor-2",
    );
    await user.type(input, " Missing@NYU.EDU ");
    await user.click(
      screen.getByRole("button", {
        name: "Add service approver for studio/a:floor-2",
      }),
    );

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Enter a valid NYU NetID email."),
    );
    expect(updateApproversMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("sorts rooms by resource ID, hides annex spaces, and offers each room's services", async () => {
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Room 10",
        resourceId: "10",
        services: ["setup"],
      },
      {
        ...defaultResource,
        name: "Room 2",
        resourceId: "2",
        services: ["equipment"],
      },
      {
        ...defaultResource,
        name: "Room 2 Annex",
        resourceId: "2A",
        parentResourceId: "2",
        services: ["catering"],
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    const room2 = await screen.findByText("2 Room 2");
    const room10 = await screen.findByText("10 Room 10");
    expect(
      room2.compareDocumentPosition(room10) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("2A Room 2 Annex")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Service for 10")).toHaveTextContent("Setup");

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Service for 2"));
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Equipment", "Catering"]);
  });

  it("shows each room's approvers and hides ones for services it no longer offers", async () => {
    listApproversMock.mockResolvedValue([
      toApproversResource("garage", {
        resourceApprovers: ["final@nyu.edu"],
        serviceApprovers: {
          equipment: ["equipment@nyu.edu"],
          catering: ["catering@nyu.edu"],
        },
      }),
    ]);

    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Garage",
        resourceId: "garage",
        services: ["equipment"],
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    expect(await screen.findByText("final@nyu.edu")).toBeInTheDocument();
    expect(screen.getByText("equipment@nyu.edu")).toBeInTheDocument();
    expect(screen.queryByText("catering@nyu.edu")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Service for garage")).toHaveTextContent(
      "Equipment",
    );
  });
});
