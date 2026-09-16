import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";

import { DateSelectArg } from "@fullcalendar/core";
import dayjs from "dayjs";
import { usePathname } from "next/navigation";
import {
  CalendarEvent,
  Department,
  Inputs,
  Role,
  RoomSetting,
  SubmitStatus,
} from "../../../types";
import { SAFETY_TRAINING_REQUIRED_ROOM } from "../../../mediaCommonsPolicy";
import { getAffectingBlackoutPeriods } from "../../../utils/blackoutUtils";
import { canAccessAdmin } from "../../../utils/permissions";
import {
  getServiceResourceId,
  getServiceRooms,
} from "../../../utils/resourceServicesUtils";
import type { ServiceDecisions } from "../../../utils/serviceDecisions";
import {
  createServiceRuleMemory,
  pruneServiceRequestsToRooms,
  ServiceRuleMemory,
} from "../../../utils/serviceSections";
import { DatabaseContext } from "../components/Provider";
import fetchCalendarEvents from "./hooks/fetchCalendarEvents";
import { useTenantSchema } from "../components/SchemaProvider";

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  existingCalendarEvents: CalendarEvent[];
  formData: Inputs | undefined;
  /**
   * Whether the Details step's answer set currently passes its validation.
   * Mirrored by the Details page; the missing-data guard reads it before
   * letting a request land on the Services step.
   */
  isDetailsValid: boolean;
  /** Which service answers a rule switched on; survives leaving the Services step. */
  serviceRuleMemory: ServiceRuleMemory;
  resetServiceRuleMemory: () => void;
  /**
   * The loaded booking's service decisions (edit and modification contexts),
   * kept beside formData so they never enter the answer set. Cleared with
   * the rest of the form.
   */
  serviceDecisions: ServiceDecisions;
  setServiceDecisions: (x: ServiceDecisions) => void;
  hasShownMocapModal: boolean;
  isBanned: boolean;
  isSafetyTrained: boolean;
  needsSafetyTraining: boolean;
  isInBlackoutPeriod: boolean;
  reloadExistingCalendarEvents: () => void;
  role: Role | undefined;
  selectedRooms: RoomSetting[];
  /** Selected auxiliary spaces keyed by parent room id. */
  annexByRoom: Record<string, string[]>;
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setFormData: (x: Inputs) => void;
  setIsDetailsValid: (x: boolean) => void;
  setHasShownMocapModal: (x: boolean) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: RoomSetting[]) => void;
  setAnnexByRoom: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
  setSubmitting: (x: SubmitStatus) => void;
  submitting: SubmitStatus;
  fetchingStatus: "loading" | "loaded" | "error" | null;
  error: Error | null;
  setError: (x: Error | null) => void;
}

export const BookingContext = createContext<BookingContextType>({
  bookingCalendarInfo: undefined,
  department: undefined,
  existingCalendarEvents: [],
  formData: undefined,
  isDetailsValid: false,
  serviceRuleMemory: createServiceRuleMemory(),
  resetServiceRuleMemory: () => {},
  serviceDecisions: {},
  setServiceDecisions: (x: ServiceDecisions) => {},
  hasShownMocapModal: false,
  isBanned: false,
  isSafetyTrained: true,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
  reloadExistingCalendarEvents: () => {},
  role: undefined,
  selectedRooms: [],
  annexByRoom: {},
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setFormData: (x: Inputs) => {},
  setIsDetailsValid: (x: boolean) => {},
  setHasShownMocapModal: (x: boolean) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: RoomSetting[]) => {},
  setAnnexByRoom: () => {},
  setSubmitting: (x: SubmitStatus) => {},
  submitting: "none",
  fetchingStatus: null,
  error: null,
  setError: (x: Error | null) => {},
});

export function BookingProvider({ children }) {
  const {
    bannedUsers,
    roomSettings,
    safetyTrainedUsers,
    userEmail,
    blackoutPeriods,
    reloadSafetyTrainedUsers,
    pagePermission,
  } = useContext(DatabaseContext);
  const pathname = usePathname();
  const schema = useTenantSchema();

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [formData, setFormData] = useState<Inputs>(undefined);
  const [isDetailsValid, setIsDetailsValid] = useState(false);
  const serviceRuleMemory = useRef(createServiceRuleMemory());
  const resetServiceRuleMemory = () => {
    Object.assign(serviceRuleMemory.current, createServiceRuleMemory());
  };
  const [serviceDecisions, setServiceDecisions] = useState<ServiceDecisions>(
    {},
  );
  const [hasShownMocapModal, setHasShownMocapModal] = useState(false);
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);
  const [annexByRoom, setAnnexByRoom] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState<SubmitStatus>("error");
  const {
    existingCalendarEvents,
    reloadExistingCalendarEvents,
    fetchingStatus,
  } = fetchCalendarEvents(roomSettings);
  const [error, setError] = useState<Error | null>(null);

  // Update safety trained users when selected rooms change
  // Each room may have a different trainingFormUrl, so we need to merge results from all rooms
  useEffect(() => {
    if (selectedRooms.length === 0) return;

    const roomsWithTraining = selectedRooms
      .filter((room) => room.needsSafetyTraining && room.trainingFormUrl)
      .map((room) => ({
        roomId: room.roomId.toString(),
        trainingFormUrl: room.trainingFormUrl,
      }));

    if (roomsWithTraining.length > 0) {
      reloadSafetyTrainedUsers(roomsWithTraining);
    } else {
      reloadSafetyTrainedUsers();
    }
  }, [selectedRooms, reloadSafetyTrainedUsers]);

  // Service requests are answered per room. When the room set changes, the
  // answers for rooms no longer part of the request are dropped right away so
  // they never reach the Services step or the submission. Rooms and answers
  // that arrive together (loading a saved booking) are left as they are.
  const serviceRooms = useMemo(
    () => getServiceRooms(selectedRooms, annexByRoom, schema.resources ?? []),
    [selectedRooms, annexByRoom, schema.resources],
  );
  const tenantShowSetup = schema.form?.services?.showSetup ?? false;
  const serviceRoomKey = serviceRooms.map(getServiceResourceId).join(",");
  const previousServiceRoomKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousServiceRoomKey.current;
    previousServiceRoomKey.current = serviceRoomKey;
    // No rooms before means nothing was answered yet: a saved booking's
    // rooms and answers arrive together and must be kept.
    if (!previous || previous === serviceRoomKey) return;
    if (!formData) return;
    const pruned = pruneServiceRequestsToRooms(
      formData,
      serviceRooms,
      tenantShowSetup,
    );
    if (pruned !== formData) setFormData(pruned);
    // formData is read, not watched: pruning runs only when the rooms change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceRoomKey]);

  const isBanned = useMemo<boolean>(() => {
    const bannedEmails = bannedUsers.map((bannedUser) => bannedUser.email);

    // For walk-in bookings, check if the walk-in person (not the PA) is banned
    if (pathname.includes("/walk-in") && formData?.walkInNetId?.length > 0) {
      return bannedEmails.includes(`${formData?.walkInNetId}@nyu.edu`);
    }

    if (!userEmail) return false;
    return bannedEmails.includes(userEmail);
  }, [userEmail, bannedUsers, formData?.walkInNetId, pathname]);

  const isSafetyTrained = useMemo(() => {
    const safetyTrainedEmails = safetyTrainedUsers.map((user) => user.email);

    // For walk-in bookings, check if the walk-in person (not the PA) has safety training
    if (pathname.includes("/walk-in") && formData?.walkInNetId?.length > 0) {
      return safetyTrainedEmails.includes(`${formData?.walkInNetId}@nyu.edu`);
    }

    if (!userEmail) return false;
    return safetyTrainedEmails.includes(userEmail);
  }, [userEmail, safetyTrainedUsers, formData?.walkInNetId, pathname]);

  // block progressing in the form is safety training requirement isn't met
  const needsSafetyTraining = useMemo(() => {
    // Safety training is not required when modifying an already-approved reservation
    if (pathname.includes("/modification")) return false;
    const isStudent = role === Role.STUDENT;
    const roomRequiresSafetyTraining = selectedRooms.some(
      (room) => room.needsSafetyTraining || false,
    );
    return isStudent && roomRequiresSafetyTraining && !isSafetyTrained;
  }, [selectedRooms, role, isSafetyTrained, pathname]);

  // Check if the booking falls within any active blackout period.
  // Admins and super admins are exempt from this restriction.
  const isInBlackoutPeriod = useMemo(() => {
    if (canAccessAdmin(pagePermission)) return false;
    if (!bookingCalendarInfo || !blackoutPeriods) return false;

    const bookingStart = dayjs(bookingCalendarInfo.start);
    const bookingEnd = dayjs(bookingCalendarInfo.end);
    const selectedRoomIds = selectedRooms.map((room) => room.roomId);
    const stringIdBlackoutPeriods = blackoutPeriods.map((period) => ({
      ...period,
      roomIds: period.roomIds?.map(String),
    }));

    const affectingPeriods = getAffectingBlackoutPeriods(
      stringIdBlackoutPeriods,
      bookingStart,
      bookingEnd,
      selectedRoomIds,
    );

    return affectingPeriods.length > 0;
  }, [bookingCalendarInfo, blackoutPeriods, selectedRooms, pagePermission]);

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        department,
        existingCalendarEvents,
        reloadExistingCalendarEvents,
        formData,
        isDetailsValid,
        serviceRuleMemory: serviceRuleMemory.current,
        resetServiceRuleMemory,
        serviceDecisions,
        setServiceDecisions,
        hasShownMocapModal,
        isBanned,
        isSafetyTrained,
        needsSafetyTraining,
        isInBlackoutPeriod,
        role,
        selectedRooms,
        annexByRoom,
        setBookingCalendarInfo,
        setDepartment,
        setFormData,
        setIsDetailsValid,
        setHasShownMocapModal,
        setRole,
        setSelectedRooms,
        setAnnexByRoom,
        setSubmitting,
        submitting,
        fetchingStatus,
        error,
        setError,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
