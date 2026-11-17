import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import SchemaEditor from "@/components/src/client/routes/super/schemaEditor";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResource } from "@/components/src/client/routes/components/schemaTypes";

const mcSchema = {
  tenantId: "mc",
  resources: [{ name: "Room A", resourceId: "room-a", capacity: 4 }],
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
          return jsonResponse({ error: "Not found" }, 404);
        }
        if (String(url).includes("/api/tenantSchema/itp")) {
          return jsonResponse({ tenantId: "itp", policy: "itp policy" });
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
      const text = (
        screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement
      ).value;
      expect(text).toContain("studio");
      expect(text).toContain(`"admin": ${defaultResource.requestLimits.perDay.admin}`);
    });
    expect(
      vi.mocked(fetch).mock.calls.some((call) => String(call[0]).includes("_template")),
    ).toBe(false);
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
    await user.click(await screen.findByRole("option", { name: "itp" }));

    await waitFor(() => {
      expect(screen.getByText("(entire schema)")).toBeInTheDocument();
      expect(
        (screen.getByRole("textbox", { name: "Schema JSON" }) as HTMLTextAreaElement)
          .value,
      ).toContain("itp policy");
    });
    expect(screen.queryByRole("region", { name: "Schema fields" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add resource" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "_template (defaults)" })).not.toBeInTheDocument();
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

  it("shows a schema error and keeps Save disabled when a boolean is a string", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));
    await user.click(await screen.findByRole("button", { name: /^supportPA/ }));

    const textarea = document.querySelector("textarea");
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: '"yes"' } });

    expect(await screen.findByText(/supportPA:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps another slice's schema error off a valid section", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method === "PUT") {
          return jsonResponse({ success: true, backupCreated: true });
        }
        if (String(url).includes("/api/tenantSchema/mc")) {
          return jsonResponse({
            tenantId: "mc",
            policy: "Bring an ID",
            resources: [
              { name: "Room A", resourceId: "room-a", capacity: 4 },
              { name: "Room B", resourceId: "room-a", capacity: 4 },
            ],
          });
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );
    renderEditor();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "mc" }));

    expect(await screen.findByText(/already in the schema/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^policy/ }));
    expect(screen.queryByText(/already in the schema/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Room A/ }));
    expect(screen.queryByText(/already in the schema/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Room B/ }));
    expect(
      await screen.findByText(/resources\[1\]\.resourceId:.*already in the schema/),
    ).toBeInTheDocument();
  });
});
