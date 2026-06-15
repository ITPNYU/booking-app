import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultResource } from "../../components/src/client/routes/components/schemaTypes";
import { ResourceEditor } from "../../components/src/client/routes/super/schemaEditor";

describe("SchemaEditor ResourceEditor", () => {
  it("edits Resource ID as text without numeric coercion", () => {
    const onUpdate = vi.fn();

    render(
      <ResourceEditor
        resource={{ ...defaultResource, resourceId: "studio-a" }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Resource ID");
    expect(input).not.toHaveAttribute("type", "number");

    fireEvent.change(input, { target: { value: "studio-b2" } });

    expect(onUpdate).toHaveBeenCalledWith(0, {
      ...defaultResource,
      resourceId: "studio-b2",
    });
  });
});
