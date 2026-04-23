export const USER_RIGHT_FLAG_FIELDS = [
  "isAdmin",
  "isWorker",
  "isLiaison",
  "isEquipment",
  "isStaffing",
  "isSetup",
  "isCatering",
  "isCleaning",
  "isSecurity",
] as const;

export type UserRightFlagField = (typeof USER_RIGHT_FLAG_FIELDS)[number];
