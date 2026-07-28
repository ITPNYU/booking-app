import {
  AdminUser,
  Approver,
  Booking,
  PagePermission,
  PolicySettings,
  PaUser,
  SafetyTraining,
} from "../../../types";

function getE2EMockData<T>(key: string): T | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const store = (window as any).__bookingE2EMocks;
  return store ? (store[key] as T) : undefined;
}

export function getE2EMockPagePermission(
  email: string | undefined,
): PagePermission | undefined {
  if (typeof window === "undefined" || !email) return undefined;

  const store = (window as any).__bookingE2EMocks;
  if (!store) return undefined;

  const normalizedEmail = email.trim().toLowerCase();
  const userRights = (store.usersRights ?? []).find(
    (record: any) => record.email?.trim().toLowerCase() === normalizedEmail,
  );
  if (userRights?.isAdmin === true) return PagePermission.ADMIN;

  const approver = (store.usersApprovers ?? []).find(
    (record: any) => record.email?.trim().toLowerCase() === normalizedEmail,
  );
  if (Number(approver?.level) === 3) return PagePermission.SERVICES;
  if (approver) return PagePermission.LIAISON;

  const hasLegacyServiceRight =
    userRights?.isSetup === true ||
    userRights?.isEquipment === true ||
    userRights?.isStaffing === true ||
    userRights?.isCatering === true ||
    userRights?.isCleaning === true ||
    userRights?.isSecurity === true;
  if (hasLegacyServiceRight) return PagePermission.SERVICES;

  const serviceApprovers =
    store.usersServiceApprovers ?? store.serviceApprovers ?? [];
  if (
    serviceApprovers.some(
      (record: any) => record.email?.trim().toLowerCase() === normalizedEmail,
    )
  ) {
    return PagePermission.SERVICES;
  }

  if (userRights?.isWorker === true) return PagePermission.PA;
  return PagePermission.BOOKING;
}

export function withE2EMockData<T>(
  key: string,
  handler: (data: T) => void,
): boolean {
  const data = getE2EMockData<T>(key);
  if (!data) {
    return false;
  }
  handler(data);
  return true;
}

export function applyE2EMockBookings(options: {
  setAllBookings: (bookings: Booking[]) => void;
  resetPagination?: () => void;
}): boolean {
  return withE2EMockData<Booking[]>("bookings", (bookings) => {
    options.setAllBookings(bookings);
    options.resetPagination?.();
  });
}

export function applyE2EMockAdminUsers(
  setAdminUsers: (users: AdminUser[]) => void,
): boolean {
  return withE2EMockData<any[]>("usersRights", (records) => {
    const admins = records
      .filter((item) => item.isAdmin === true)
      .map((item) => ({
        email: item.email,
        createdAt: item.createdAt,
      }));
    setAdminUsers(admins);
  });
}

export function applyE2EMockPaUsers(
  setPaUsers: (users: PaUser[]) => void,
): boolean {
  return withE2EMockData<any[]>("usersRights", (records) => {
    const users = records
      .filter((item) => item.isWorker === true)
      .map((item) => ({
        email: item.email,
        createdAt: item.createdAt,
      }));
    setPaUsers(users);
  });
}

export function applyE2EMockSafetyUsers(
  setSafetyUsers: (users: SafetyTraining[]) => void,
): boolean {
  return withE2EMockData<SafetyTraining[]>(
    "safetyTrainedUsers",
    setSafetyUsers,
  );
}

export function applyE2EMockApprovers(options: {
  setLiaisonUsers: (users: Approver[]) => void;
  setEquipmentUsers: (users: Approver[]) => void;
  setPolicySettings: (settings: PolicySettings) => void;
}): boolean {
  return withE2EMockData<any[]>("usersApprovers", (records) => {
    const all = records.map((item) => ({
      email: item.email,
      department: item.department,
      createdAt: item.createdAt,
      level: Number(item.level),
    }));

    const liaisons = all.filter((x) => x.level === 1);
    const equipmentUsers = all.filter((x) => x.level === 3);
    const finalApproverEmail = all.find((x) => x.level === 2)?.email ?? "";

    options.setLiaisonUsers(liaisons);
    options.setEquipmentUsers(equipmentUsers);
    options.setPolicySettings({ finalApproverEmail });
  });
}
