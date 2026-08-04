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
  clientListResourceApprovers,
} from "@/lib/firebase/firebase";

vi.mock("@/lib/firebase/firebase", () => ({
  clientAddResourceApprover: vi.fn(),
  clientListResourceApprovers: vi.fn(),
  clientRemoveResourceApprover: vi.fn(),
}));

const listApproversMock = vi.mocked(clientListResourceApprovers);
const addApproverMock = vi.mocked(clientAddResourceApprover);

describe("ResourceSpecific", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApproversMock.mockResolvedValue([]);
    addApproverMock.mockResolvedValue();
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

    expect(
      await screen.findByText("studio/a:floor-2 Audio Studio"),
    ).toBeInTheDocument();
    expect(screen.getByText("Resource Approvers")).toBeInTheDocument();

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
    expect(screen.queryByText("Service Approvers")).not.toBeInTheDocument();
  });
});
