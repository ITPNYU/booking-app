import { selectIdentityRecord } from "@/app/api/nyu/identity/[uniqueId]/route";

describe("selectIdentityRecord", () => {
  it("returns the employee record when present in array", () => {
    const data = [
      { affiliation: "student", name: "Alice" },
      { affiliation: "employee", name: "Bob" },
    ];
    expect(selectIdentityRecord(data)).toEqual({
      affiliation: "employee",
      name: "Bob",
    });
  });

  it("returns the first record when no employee in array", () => {
    const data = [
      { affiliation: "student", name: "Alice" },
      { affiliation: "faculty", name: "Carol" },
    ];
    expect(selectIdentityRecord(data)).toEqual({
      affiliation: "student",
      name: "Alice",
    });
  });

  it("returns null for an empty array", () => {
    expect(selectIdentityRecord([])).toBeNull();
  });

  it("returns the object as-is for a single object (backward compat)", () => {
    const data = { affiliation: "employee", name: "Bob" };
    expect(selectIdentityRecord(data)).toEqual(data);
  });

  it("returns null for null input", () => {
    expect(selectIdentityRecord(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(selectIdentityRecord(undefined)).toBeNull();
  });
});
