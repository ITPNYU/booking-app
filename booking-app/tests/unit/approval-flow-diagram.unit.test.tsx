import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import SchemaEditor from "@/components/src/client/routes/super/schemaEditor";
import { layoutApprovalFlow } from "@/components/src/client/routes/super/approvalFlowDiagram";
import ApprovalFlowDiagram from "@/components/src/client/routes/super/approvalFlowDiagramView";
import { itpApprovalFlow } from "@/lib/stateMachines/flows/itpApprovalFlow";
import { mcApprovalFlow } from "@/lib/stateMachines/flows/mcApprovalFlow";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("layoutApprovalFlow", () => {
  it("rejects JSON that has no states", () => {
    expect(layoutApprovalFlow({ id: "Approval Flow" }).ok).toBe(false);
  });

  it("lays the ITP graph out from Requested", () => {
    const diagram = layoutApprovalFlow(itpApprovalFlow);
    expect(diagram.ok).toBe(true);
    if (!diagram.ok) return;
    const requested = diagram.nodes.find((node) => node.name === "Requested");
    const approved = diagram.nodes.find((node) => node.name === "Approved");
    expect(diagram.machineId).toBe("ITP Booking Request");
    expect(requested).toMatchObject({ column: 0, initial: true });
    expect(approved && approved.column).toBeGreaterThan(0);
    expect(diagram.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "Requested",
          to: "Approved",
          label: "approve",
        }),
        expect.objectContaining({
          from: "Declined",
          to: "Canceled",
          label: "after 1 day",
        }),
      ]),
    );
    expect(requested?.loops).toEqual(
      expect.arrayContaining(["edit", "always"]),
    );
    expect(
      diagram.edges.some(
        (edge) => edge.from === "Requested" && edge.to === "Requested",
      ),
    ).toBe(false);
  });

  it("opens a parallel region and keeps its exits on the parent", () => {
    const top = layoutApprovalFlow(mcApprovalFlow);
    expect(top.ok).toBe(true);
    if (!top.ok) return;
    expect(
      top.nodes.find((node) => node.name === "Services Request"),
    ).toMatchObject({ kind: "parallel", clickable: true });

    const regions = layoutApprovalFlow(mcApprovalFlow, ["Services Request"]);
    expect(regions.ok).toBe(true);
    if (!regions.ok) return;
    expect(regions.nodes.map((node) => node.name)).toContain("Staff Request");
    expect(regions.nodes.every((node) => node.column === 0)).toBe(true);
    expect(regions.exits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "onDone",
          to: "Evaluate Services Request",
        }),
      ]),
    );

    const staff = layoutApprovalFlow(mcApprovalFlow, [
      "Services Request",
      "Staff Request",
    ]);
    expect(staff.ok).toBe(true);
    if (!staff.ok) return;
    expect(staff.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "Staff Requested",
          to: "Staff Approved",
          label: "approveStaff",
        }),
      ]),
    );
  });
});

describe("ApprovalFlowDiagram", () => {
  it("draws a nested region from the same JSON", async () => {
    const user = userEvent.setup();
    render(<ApprovalFlowDiagram value={mcApprovalFlow} />);

    expect(screen.getByText("MC Booking Request")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Open Services Request" }),
    );
    expect(screen.getByText("Services Request")).toBeInTheDocument();
    expect(
      screen.getByText("onDone → Evaluate Services Request"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Open Staff Request" }),
    );
    expect(screen.getByText("Staff Approved")).toBeInTheDocument();
  });
});

describe("SchemaEditor approval flow view", () => {
  it("switches the approval flow between JSON and a read-only diagram", async () => {
    const user = userEvent.setup();
    const saved = {
      tenantId: "mc",
      approvalFlow: {
        id: "Saved Flow",
        initial: "Requested",
        states: {
          Requested: { on: { approve: { target: "Approved" } } },
          Approved: { type: "final" },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("/api/tenantSchema/mc")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => saved,
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({ error: "not found" }),
        });
      }),
    );

    render(
      <DatabaseContext.Provider value={{ userEmail: "admin@nyu.edu" } as never}>
        <SchemaEditor />
      </DatabaseContext.Provider>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));
    await user.click(
      await screen.findByRole("button", { name: "approvalFlow" }),
    );

    const json = screen.getByRole("textbox", {
      name: "Schema JSON",
    }) as HTMLTextAreaElement;
    expect(json.value).toContain("Saved Flow");
    expect(
      screen.queryByText("Read-only. Switch to JSON to change the flow."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Diagram" }));
    expect(screen.getByText("Saved Flow")).toBeInTheDocument();
    expect(screen.getAllByText("approve").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("textbox", { name: "Schema JSON" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "JSON" }));
    await waitFor(() => {
      expect(
        (
          screen.getByRole("textbox", {
            name: "Schema JSON",
          }) as HTMLTextAreaElement
        ).value,
      ).toContain("Saved Flow");
    });
  });
});
