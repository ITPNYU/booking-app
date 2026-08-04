import { describe, expect, it } from "vitest";

import getEnvironmentTitle from "@/components/src/client/routes/components/getEnvironmentTitle";

describe("getEnvironmentTitle", () => {
  it("does not render an environment label when the branch is unavailable", () => {
    expect(getEnvironmentTitle()).toBe("");
  });

  it("does not render an environment label for production", () => {
    expect(getEnvironmentTitle("production")).toBe("");
    expect(getEnvironmentTitle(" Production ")).toBe("");
  });

  it("formats non-production branch labels", () => {
    expect(getEnvironmentTitle("development-local")).toBe(
      "[Development-local]",
    );
  });
});
