import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import SchemaGenerator from "@/components/src/client/routes/super/schemaGenerator";

const template = generateDefaultSchema("_template");

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("SchemaGenerator", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/_template")) {
        return jsonResponse(template);
      }
      if (init?.method === "POST") {
        return jsonResponse({ success: true, tenantId: "studio" });
      }
      return jsonResponse({ ids: ["mc", "itp"] });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("blocks a bad payload and submits the confirmed JSON", async () => {
    render(<SchemaGenerator />);

    const slug = await screen.findByLabelText(/Slug/);
    fireEvent.change(slug, { target: { value: "studio" } });
    fireEvent.change(screen.getByLabelText(/Display name/), {
      target: { value: "Studio Lab" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build JSON" }));

    const editor = screen.getByPlaceholderText(/Build JSON/);
    const built = JSON.parse((editor as HTMLTextAreaElement).value);
    expect(built.tenantId).toBe("studio");
    expect(built.tenant.name).toBe("Studio Lab");
    expect(built.bookingProfile).toBe("itp");
    expect(built.access.allNyu).toBe(true);

    fireEvent.change(editor, {
      target: { value: "{not json" },
    });
    expect(await screen.findByText(/JSON parse error/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review and create" })).toBeDisabled();

    built.resources = [{ resourceId: "a,b", name: "Bad" }];
    fireEvent.change(editor, {
      target: { value: JSON.stringify(built) },
    });
    expect(await screen.findByText(/Invalid schema/)).toBeTruthy();

    built.resources = [];
    fireEvent.change(editor, {
      target: { value: JSON.stringify(built, null, 2) },
    });
    await waitFor(() => {
      expect(screen.queryByText(/Invalid schema/)).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Review and create" }));
    expect(await screen.findByText("Create tenant schema")).toBeTruthy();
    expect(screen.getByText("Slug: studio")).toBeTruthy();
    expect(screen.getByText("Name: Studio Lab")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create tenant" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(String((post?.[1] as RequestInit).body));
      expect(body.tenantId).toBe("studio");
      expect(body.tenant.name).toBe("Studio Lab");
      expect(body.bookingProfile).toBe("itp");
      expect(body.access).toEqual({ allNyu: true, deptCodes: [] });
    });
  });
});
