import {
  Approver,
  Booking,
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

export function withE2EMockData<T>(
  key: string,
  handler: (data: T) => void
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
  setAdminUsers: (users: AdminUser[]) => void
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
  setPaUsers: (users: PaUser[]) => void
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
  setSafetyUsers: (users: SafetyTraining[]) => void
): boolean {
  return withE2EMockData<SafetyTraining[]>(
    "safetyTrainedUsers",
    setSafetyUsers
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
