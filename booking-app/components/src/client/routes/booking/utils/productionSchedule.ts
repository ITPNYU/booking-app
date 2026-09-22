/**
 * Whether a reservation length requires a production schedule.
 * Threshold is exclusive: duration must be strictly greater than requiredAboveHours.
 */
export function isProductionScheduleRequired(
  start: Date,
  end: Date,
  requiredAboveHours: number,
): boolean {
  if (
    !Number.isFinite(requiredAboveHours) ||
    requiredAboveHours < 0 ||
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return false;
  }
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return durationHours > requiredAboveHours;
}

export function getReservationDurationHours(
  start: Date | undefined | null,
  end: Date | undefined | null,
): number | null {
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}
