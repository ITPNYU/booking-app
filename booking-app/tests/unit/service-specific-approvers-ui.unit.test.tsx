import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceSpecificApprovers } from "@/components/src/client/routes/admin/components/ServiceSpecificApprovers";
import {
  defaultResource,
  generateDefaultSchema,
  SchemaProvider,
} from "@/components/src/client/routes/components/SchemaProvider";
import {
  clientAddServiceApprover,
  clientListServiceApprovers,
} from "@/lib/firebase/firebase";

vi.mock("@/lib/firebase/firebase", () => ({
  clientAddServiceApprover: vi.fn(),
  clientListServiceApprovers: vi.fn(),
  clientRemoveServiceApprover: vi.fn(),
}));

const listApproversMock = vi.mocked(clientListServiceApprovers);
const addApproverMock = vi.mocked(clientAddServiceApprover);

describe("ServiceSpecificApprovers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApproversMock.mockResolvedValue([]);
    addApproverMock.mockResolvedValue();
  });

  it("labels service approver email inputs by resource and service", async () => {
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
        <ServiceSpecificApprovers />
      </SchemaProvider>,
    );

    const input = await screen.findByLabelText(
      "Add Setup approver email for Audio Studio",
    );
    await user.type(input, " Person@NYU.EDU ");
    await user.click(
      screen.getByRole("button", {
        name: "Add Setup approver for Audio Studio",
      }),
    );

    await waitFor(() =>
      expect(addApproverMock).toHaveBeenCalledWith(
        "studio/a:floor-2",
        "setup",
        "Person@NYU.EDU",
        "tenant-one",
      ),
    );
  });
});
