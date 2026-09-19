// Display order for resources, shared everywhere a resource list is shown.
// Resource IDs are opaque strings; numeric-aware sorting keeps "103" before
// "1201".
export const compareResourceIds = (
  a: string | number,
  b: string | number,
): number => String(a).localeCompare(String(b), undefined, { numeric: true });
