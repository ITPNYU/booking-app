import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResourceSpecific } from "@/components/src/client/routes/admin/components/ResourceSpecific";
import {
  defaultResource,
  generateDefaultSchema,
  SchemaProvider,
} from "@/components/src/client/routes/components/SchemaProvider";
import {
  clientAddResourceApprover,
  clientAddServiceApprover,
  clientListResourceApprovers,
  clientListServiceApprovers,
} from "@/lib/firebase/firebase";

vi.mock("@/lib/firebase/firebase", () => ({
  clientAddResourceApprover: vi.fn(),
  clientAddServiceApprover: vi.fn(),
  clientListResourceApprovers: vi.fn(),
  clientListServiceApprovers: vi.fn(),
  clientRemoveResourceApprover: vi.fn(),
  clientRemoveServiceApprover: vi.fn(),
}));

const listApproversMock = vi.mocked(clientListResourceApprovers);
const listServiceApproversMock = vi.mocked(clientListServiceApprovers);
const addApproverMock = vi.mocked(clientAddResourceApprover);
const addServiceApproverMock = vi.mocked(clientAddServiceApprover);

describe("ResourceSpecific", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApproversMock.mockResolvedValue([]);
    listServiceApproversMock.mockResolvedValue([]);
    addApproverMock.mockResolvedValue();
    addServiceApproverMock.mockResolvedValue();
  });

  it("adds a normalized approver for an opaque resource ID", async () => {
    const user = userEvent.setup();
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Audio Studio",
        resourceId: "studio/a:floor-2",
      },
    ];

    render(
      <SchemaProvider value={schema}>
        <ResourceSpecific />
      </SchemaProvider>,
    );

    expect(await screen.findByText("studio/a:floor-2 Audio Studio")).toBeInTheDocument();
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
      expect(addApproverMock).toHaveBeenCalledWith(
        "studio/a:floor-2",
        "person@nyu.edu",
        "tenant-one",
      ),
    );
  });

  it("adds a service approver for a resource and service", async () => {
    const user = userEvent.setup();
    const schema = generateDefaultSchema("tenant-one");
    schema.resources = [
      {
        ...defaultResource,
        name: "Audio Studio",
        resourceId: "studio/a:floor-2",
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
      expect(addServiceApproverMock).toHaveBeenCalledWith(
        "studio/a:floor-2",
        "setup",
        "service@nyu.edu",
        "tenant-one",
      ),
    );
  });
});
