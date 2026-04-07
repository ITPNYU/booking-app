function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function selectIdentityRecord(
  data: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(data)) return isRecord(data) ? data : null;
  const records = data.filter(isRecord);
  return (
    records.find((r) => String(r.affiliation_number) === "1") ??
    records.find((r) => String(r.affiliation).toLowerCase() === "employee") ??
    records[0] ??
    null
  );
}
