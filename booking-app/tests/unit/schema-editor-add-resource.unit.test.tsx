import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import SchemaEditor from "@/components/src/client/routes/super/schemaEditor";
import { plainResourceDefault } from "@/lib/tenant/resourceDefault";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mcSchema = {
  ...JSON.parse(JSON.stringify(generateDefaultSchema("mc"))),
  resources: [
    {
      ...plainResourceDefault(),
      name: "Room A",
      resourceId: "room-a",
      capacity: 4,
    },
  ],
};

const resourceDefault = {
  name: "",
  resourceId: "",
  capacity: 0,
  calendarId: "",
  calendarIdProd: "",
  isEquipment: false,
  isWalkIn: false,
  requestLimits: { perSemester: { admin: -1, faculty: -1, student: -1 } },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function renderEditor() {
  return render(
    <DatabaseContext.Provider value={{ userEmail: "admin@nyu.edu" } as never}>
      <SchemaEditor />
    </DatabaseContext.Provider>,
  );
}

describe("SchemaEditor add resource", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "PUT") {
          return jsonResponse({ success: true, backupCreated: true });
        }
        if (String(url).includes("_template")) {
          return jsonResponse({ resourceDefault });
        }
        if (String(url).includes("/api/tenantSchema/mc")) {
          return jsonResponse(mcSchema);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );
  });

  it("updates the JSON on the page and writes only after Save is confirmed", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));

    await waitFor(() => {
      expect(
        (screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement)
          .value,
      ).toContain("room-a");
    });
    expect(screen.queryByRole("region", { name: "Schema fields" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /1 items/ }));
    expect(screen.getByLabelText("Resource")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Schema fields" }),
    ).not.toBeInTheDocument();

    const addButton = await screen.findByRole("button", { name: "Add resource" });
    await waitFor(() => expect(addButton).toBeEnabled());
    await user.click(addButton);
    await user.type(screen.getByLabelText("Name"), "Studio");
    await user.type(screen.getByLabelText("Resource id"), "studio");
    await user.click(screen.getByRole("button", { name: "Add to schema" }));

    await waitFor(() => {
      expect(
        (screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement)
          .value,
      ).toContain("studio");
    });
    expect(
      vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "PUT"),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(await screen.findByRole("button", { name: /Save \(.*changes\)/ }));

    await waitFor(() => {
      const put = vi
        .mocked(fetch)
        .mock.calls.find((call) => call[1]?.method === "PUT");
      expect(put?.[0]).toBe("/api/tenantSchema/mc");
      expect(String(put?.[1]?.body)).toContain("studio");
    });
  });

  it("shows the whole document after switching tenants", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));
    await user.click(await screen.findByRole("button", { name: /^policy/ }));
    expect(screen.queryByText("(entire schema)")).not.toBeInTheDocument();

    const [tenantSelect] = screen.getAllByRole("combobox");
    await user.click(tenantSelect);
    await user.click(await screen.findByRole("option", { name: "_template (defaults)" }));

    await waitFor(() => {
      expect(screen.getByText("(entire schema)")).toBeInTheDocument();
      expect(
        (screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement)
          .value,
      ).toContain("resourceDefault");
    });
    expect(screen.queryByRole("region", { name: "Schema fields" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add resource" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "resourceDefault" }));
    expect(screen.getByRole("region", { name: "Schema fields" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("shows a schema error and keeps save disabled when a value has the wrong type", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));
    await user.click(await screen.findByRole("button", { name: /^supportPA/ }));

    const json = screen.getByRole("textbox", { name: "Schema JSON" });
    await user.clear(json);
    await user.type(json, '"yes"');

    expect(await screen.findByText("Schema validation")).toBeInTheDocument();
    expect(screen.getByText(/must be boolean/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("updates a non-resource section from the form without writing yet", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));
    await user.click(await screen.findByRole("button", { name: /^policy/ }));

    await user.type(screen.getByLabelText("policy"), "Bring an ID");

    await waitFor(() => {
      expect(
        (screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement)
          .value,
      ).toContain("Bring an ID");
    });
    expect(
      vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "PUT"),
    ).toBe(false);
  });
});
