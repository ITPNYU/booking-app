import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import SchemaResourceForm from "@/components/src/client/routes/super/schemaResourceForm";

const resourceDefault = {
  name: "",
  resourceId: "",
  capacity: 0,
  calendarId: "",
  calendarIdProd: "",
  isEquipment: false,
  isWalkIn: false,
  requestLimits: {
    perSemester: { admin: -1, faculty: -1, student: -1 },
  },
};

const schema = {
  tenantId: "mc",
  resources: [{ name: "Room A", resourceId: "room-a", capacity: 4 }],
} as SchemaContextType;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("SchemaResourceForm", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (String(url).includes("_template") && (!init?.method || init.method === "GET")) {
          return jsonResponse({ resourceDefault });
        }
        return jsonResponse({ error: "unexpected" }, 500);
      }),
    );
  });

  it("appends a resource in memory and does not write the tenant schema", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    const addButton = await screen.findByRole("button", { name: "Add resource" });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);
    await user.type(screen.getByLabelText("Name"), "Studio");
    await user.type(screen.getByLabelText("Resource id"), "studio");
    await user.clear(screen.getByLabelText("Capacity"));
    await user.type(screen.getByLabelText("Capacity"), "12");
    await user.click(screen.getByRole("button", { name: "Add to schema" }));

    expect(onSchemaChange).toHaveBeenCalledTimes(1);
    const next = onSchemaChange.mock.calls[0][0] as SchemaContextType;
    expect(next.resources).toHaveLength(2);
    expect(next.resources[1]).toMatchObject({
      name: "Studio",
      resourceId: "studio",
      capacity: 12,
      requestLimits: resourceDefault.requestLimits,
    });
    expect(vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "PUT")).toBe(
      false,
    );
  });

  it("updates the resource chosen in the dropdown", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    await user.click(await screen.findByRole("combobox", { name: "Resource" }));
    await user.click(await screen.findByRole("option", { name: /Room A · room-a · capacity 4/ }));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Ballroom A");
    await user.click(screen.getByRole("button", { name: "Update resource" }));

    expect(onSchemaChange).toHaveBeenCalledTimes(1);
    const next = onSchemaChange.mock.calls[0][0] as SchemaContextType;
    expect(next.resources).toHaveLength(1);
    expect(next.resources[0]).toMatchObject({
      name: "Ballroom A",
      resourceId: "room-a",
      capacity: 4,
    });
  });

  it("edits hours and services on the selected resource", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    const withDetails = {
      ...schema,
      resources: [
        {
          name: "Room A",
          resourceId: "room-a",
          capacity: 4,
          maxHour: {
            student: 4,
            faculty: 8,
            admin: 12,
            studentWalkIn: 4,
            facultyWalkIn: 8,
            adminWalkIn: 12,
            studentVIP: 8,
            facultyVIP: 12,
            adminVIP: 16,
          },
          services: { setup: { label: "Room Setup", descriptionHtml: "" } },
        },
      ],
    } as SchemaContextType;
    render(<SchemaResourceForm schema={withDetails} onSchemaChange={onSchemaChange} />);

    await user.click(await screen.findByRole("combobox", { name: "Resource" }));
    await user.click(await screen.findByRole("option", { name: /Room A · room-a · capacity 4/ }));

    const maxHours = screen.getAllByRole("region", { name: "Maximum hours" })[0];
    const student = within(maxHours).getByLabelText("Student");
    await user.clear(student);
    await user.type(student, "6");

    await user.click(screen.getByRole("button", { name: "Setup" }));
    const label = screen.getByLabelText("Label");
    await user.clear(label);
    await user.type(label, "Garage layout");
    await user.click(screen.getByRole("button", { name: "Update resource" }));

    const next = onSchemaChange.mock.calls[0][0] as SchemaContextType;
    expect(next.resources[0].maxHour?.student).toBe(6);
    expect(next.resources[0].services).toMatchObject({
      setup: { label: "Garage layout" },
    });
  });

  it("deletes the resource chosen in the dropdown", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    await user.click(await screen.findByRole("combobox", { name: "Resource" }));
    await user.click(await screen.findByRole("option", { name: /Room A · room-a · capacity 4/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onSchemaChange).toHaveBeenCalledTimes(1);
    const next = onSchemaChange.mock.calls[0][0] as SchemaContextType;
    expect(next.resources).toEqual([]);
    expect(vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "PUT")).toBe(
      false,
    );
  });

  it("leaves the schema unchanged when the form is cancelled", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    const addButton = await screen.findByRole("button", { name: "Add resource" });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);
    await user.type(screen.getByLabelText("Resource id"), "studio");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSchemaChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Resource id")).not.toBeInTheDocument();
  });

  it("rejects a duplicate resource id", async () => {
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    const addButton = await screen.findByRole("button", { name: "Add resource" });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);
    await user.type(screen.getByLabelText("Resource id"), "room-a");
    await user.click(screen.getByRole("button", { name: "Add to schema" }));

    expect(await screen.findByText(/already in the schema/i)).toBeInTheDocument();
    expect(onSchemaChange).not.toHaveBeenCalled();
  });

  it("offers initialize when the database has no resource default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return jsonResponse({ success: true });
        }
        if (String(url).includes("_template")) {
          return jsonResponse({ error: "Resource default not found" }, 404);
        }
        return jsonResponse({ error: "unexpected" }, 500);
      }),
    );
    const user = userEvent.setup();
    const onSchemaChange = vi.fn();
    render(<SchemaResourceForm schema={schema} onSchemaChange={onSchemaChange} />);

    const addButton = await screen.findByRole("button", { name: "Add resource" });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);
    expect(screen.getByText(/no resource default is stored/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Initialize resource default" }),
    );

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/tenantSchema/_template",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(onSchemaChange).not.toHaveBeenCalled();
  });
});
