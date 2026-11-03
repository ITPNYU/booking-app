import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import SchemaEditor from "@/components/src/client/routes/super/schemaEditor";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("SchemaEditor create tenant", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = String(url);
        if (method === "POST") {
          return jsonResponse({ success: true, tenantId: "studio" });
        }
        if (path === "/api/tenantSchema") {
          return jsonResponse({ ids: ["mc", "itp", "_template"] });
        }
        if (path.includes("/api/tenantSchema/studio")) {
          return jsonResponse({
            tenantId: "studio",
            tenant: { name: "Studio Lab", logo: "", nameForPolicy: "" },
            resources: [],
          });
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );
  });

  it("writes the schema only after confirmation and lists the new slug", async () => {
    const user = userEvent.setup();
    render(
      <DatabaseContext.Provider value={{ userEmail: "admin@nyu.edu" } as never}>
        <SchemaEditor />
      </DatabaseContext.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "New tenant" }));
    await user.type(screen.getByLabelText(/Slug/i), "studio");
    await user.type(screen.getByLabelText(/Display name/i), "Studio Lab");
    await user.click(screen.getByRole("button", { name: "Review JSON" }));

    const preview = screen.getByRole("textbox", { name: "New tenant JSON" }) as HTMLTextAreaElement;
    expect(preview.value).toContain('"tenantId": "studio"');
    expect(preview.value).toContain('"resources": []');

    await user.click(screen.getByRole("button", { name: "Create tenant" }));
    expect(
      vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "POST"),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Create tenant schema" }));

    await waitFor(() => {
      const post = vi
        .mocked(fetch)
        .mock.calls.find((call) => call[1]?.method === "POST");
      expect(post?.[0]).toBe("/api/tenantSchema");
      const body = JSON.parse(String(post?.[1]?.body));
      expect(body.tenantId).toBe("studio");
      expect(body.tenant.name).toBe("Studio Lab");
      expect(body.resources).toEqual([]);
    });
    expect(
      vi.mocked(fetch).mock.calls.some(
        (call) => call[1]?.method === "POST" && String(call[0]).includes("/studio"),
      ),
    ).toBe(false);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveTextContent("studio");
    });
  });

  it("deletes a created schema after confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        const path = String(url);
        if (method === "DELETE") {
          return jsonResponse({ success: true, backupCreated: true });
        }
        if (path === "/api/tenantSchema") {
          return jsonResponse({ ids: ["mc", "itp", "_template", "studio"] });
        }
        if (path.includes("/api/tenantSchema/studio")) {
          return jsonResponse({
            tenantId: "studio",
            tenant: { name: "Studio Lab", logo: "", nameForPolicy: "" },
            resources: [],
          });
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    const user = userEvent.setup();
    render(
      <DatabaseContext.Provider value={{ userEmail: "admin@nyu.edu" } as never}>
        <SchemaEditor />
      </DatabaseContext.Provider>,
    );

    expect(screen.queryByRole("button", { name: "Delete schema" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "studio" }));
    await user.click(await screen.findByRole("button", { name: "Delete schema" }));
    expect(
      vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === "DELETE"),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Delete tenant schema" }));

    await waitFor(() => {
      const deleted = vi
        .mocked(fetch)
        .mock.calls.find((call) => call[1]?.method === "DELETE");
      expect(deleted?.[0]).toBe("/api/tenantSchema/studio");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "studio" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "mc" })).toBeInTheDocument();
  });
});
