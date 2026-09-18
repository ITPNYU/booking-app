import {
  createContext,
  useCallback,
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
import {
  createServiceRuleMemory,
  pruneServiceRequestsToRooms,
  pruneServiceRuleMemoryToRooms,
  ServiceRuleMemory,
} from "../../../utils/serviceSections";
import { DatabaseContext } from "../components/Provider";
import fetchCalendarEvents from "./hooks/fetchCalendarEvents";
import {
  getBookingFlowKey,
  isBookingStepPath,
} from "./utils/bookingUrlParser";
import { useTenantSchema } from "../components/SchemaProvider";

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  existingCalendarEvents: CalendarEvent[];
  formData: Inputs | undefined;
  /**
   * Whether the Details step's answer set passed its validation. Recorded
   * by the Details page when Next validates it and withdrawn on any later
   * edit; the missing-data guard reads it before letting a request land on
   * the Services step. Holds only for the request
   * (tenant, flow, booking id and attempt), role and rooms it was validated
   * against.
   */
  isDetailsValid: boolean;
  /** Which service answers a rule switched on; survives leaving the Services step. */
  serviceRuleMemory: ServiceRuleMemory;
  resetServiceRuleMemory: () => void;
  /**
   * Agreement attestations ticked so far, by attestation id. Kept here so
   * they survive the submit block remounting within a request. Hold only
   * for the request they were ticked in.
   */
  checkedAgreements: Record<string, boolean>;
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
  setCheckedAgreements: (x: Record<string, boolean>) => void;
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
  checkedAgreements: {},
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
  setCheckedAgreements: (x: Record<string, boolean>) => {},
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

const NO_AGREEMENTS: Record<string, boolean> = {};
const INITIAL_SUBMIT_STATUS: SubmitStatus = "error";

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
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);
  // This provider outlives a request: moving from one flow or booking to
  // another keeps it mounted. Details validity, the service rule memory, the
  // ticked agreements and the submit status are tied to the request they were
  // recorded in, so another request never inherits them, whether or not its
  // entry point cleared them.
  //
  // A new request has no booking id, so two attempts at the same flow share a
  // pathname. Leaving the flow's steps, for its landing page or any other
  // page, ends the attempt: the steps reached afterwards belong to a new one.
  const [attempt, setAttempt] = useState({ pathname, count: 0 });
  if (attempt.pathname !== pathname) {
    setAttempt({
      pathname,
      count: isBookingStepPath(pathname) ? attempt.count : attempt.count + 1,
    });
  }
  const flowKey = `${getBookingFlowKey(pathname)}#${attempt.count}`;
  // Details validation also reads the role (sponsor) and the rooms' capacity
  // (expected attendance), which change on other steps. Validity holds only
  // for the values it was checked against, so changing them sends the
  // request back through Details even if that step was skipped on the way.
  const detailsValidityKey = [
    flowKey,
    role ?? "",
    ...selectedRooms.map((room) => `${room.roomId}:${room.capacity}`),
  ].join("|");
  const [detailsValidKey, setDetailsValidKey] = useState<string | null>(null);
  const isDetailsValid = detailsValidKey === detailsValidityKey;
  const setIsDetailsValid = useCallback(
    (x: boolean) => setDetailsValidKey(x ? detailsValidityKey : null),
    [detailsValidityKey],
  );
  const serviceRuleMemory = useRef(createServiceRuleMemory());
  const resetServiceRuleMemory = () => {
    Object.assign(serviceRuleMemory.current, createServiceRuleMemory());
  };
  // Reset while rendering, not in an effect: the Services step reads the
  // memory in its own effects, which run before this provider's.
  const serviceRuleMemoryFlowKey = useRef(flowKey);
  if (serviceRuleMemoryFlowKey.current !== flowKey) {
    serviceRuleMemoryFlowKey.current = flowKey;
    resetServiceRuleMemory();
  }
  const [agreements, setAgreements] = useState<{
    flowKey: string;
    checked: Record<string, boolean>;
  } | null>(null);
  const checkedAgreements =
    agreements?.flowKey === flowKey ? agreements.checked : NO_AGREEMENTS;
  const setCheckedAgreements = useCallback(
    (checked: Record<string, boolean>) => setAgreements({ flowKey, checked }),
    [flowKey],
  );
  const [hasShownMocapModal, setHasShownMocapModal] = useState(false);
  const [annexByRoom, setAnnexByRoom] = useState<Record<string, string[]>>({});
  // A finished submission is terminal for its own attempt only: "success"
  // switches off the missing-data guard, which the next request needs back.
  const [submission, setSubmission] = useState<{
    flowKey: string;
    status: SubmitStatus;
  } | null>(null);
  const submitting =
    submission?.flowKey === flowKey ? submission.status : INITIAL_SUBMIT_STATUS;
  const setSubmitting = useCallback(
    (status: SubmitStatus) => setSubmission({ flowKey, status }),
    [flowKey],
  );
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
    // The rule memory of a dropped room goes with its answers.
    pruneServiceRuleMemoryToRooms(serviceRuleMemory.current, serviceRooms);
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
        checkedAgreements,
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
        setCheckedAgreements,
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
