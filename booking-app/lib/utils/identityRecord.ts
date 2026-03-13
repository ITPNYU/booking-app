export function selectIdentityRecord(
  data: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(data)) return (data as Record<string, unknown>) ?? null;
  return (
    data.find(
      (r: Record<string, unknown>) => r.affiliation_number === "1",
    ) ??
    data.find((r: Record<string, unknown>) => r.affiliation === "employee") ??
    data[0] ??
    null
  );
}
