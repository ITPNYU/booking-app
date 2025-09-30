import { TableNames } from "@/components/src/policy";
import {
  cancel,
  checkOut,
  checkin,
  clientApproveBooking,
  clientEquipmentApprove,
  clientSendToEquipment,
  decline,
  noShow,
} from "@/components/src/server/db";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import {
  getMediaCommonsServices,
  isMediaCommons,
} from "@/components/src/utils/tenantUtils";
import {
  createXStateChecker,
  getXStateContext,
} from "@/components/src/utils/xstateUnified";
import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { Timestamp } from "@firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import useExistingBooking from "./useExistingBooking";

export enum Actions {
  CANCEL = "Cancel",
  NO_SHOW = "No Show",
  CHECK_IN = "Check In",
  CHECK_OUT = "Check Out",
  FIRST_APPROVE = "1st Approve",
  FINAL_APPROVE = "2nd Approve",
  EQUIPMENT_APPROVE = "Equipment Approve",
  SEND_TO_EQUIPMENT = "Send to Equipment",
  DECLINE = "Decline",
  EDIT = "Edit",
  MODIFICATION = "Modification",
  // Media Commons Service Actions
  APPROVE_STAFF_SERVICE = "Approve Staff",
  APPROVE_EQUIPMENT_SERVICE = "Approve Equipment",
  APPROVE_CATERING_SERVICE = "Approve Catering",
  APPROVE_CLEANING_SERVICE = "Approve Cleaning",
  APPROVE_SECURITY_SERVICE = "Approve Security",
  APPROVE_SETUP_SERVICE = "Approve Setup",
  DECLINE_STAFF_SERVICE = "Decline Staff",
  DECLINE_EQUIPMENT_SERVICE = "Decline Equipment",
  DECLINE_CATERING_SERVICE = "Decline Catering",
  DECLINE_CLEANING_SERVICE = "Decline Cleaning",
  DECLINE_SECURITY_SERVICE = "Decline Security",
  DECLINE_SETUP_SERVICE = "Decline Setup",
  // Media Commons Service Closeout Actions
  CLOSEOUT_STAFF_SERVICE = "Closeout Staff",
  CLOSEOUT_EQUIPMENT_SERVICE = "Closeout Equipment",
  CLOSEOUT_CATERING_SERVICE = "Closeout Catering",
  CLOSEOUT_CLEANING_SERVICE = "Closeout Cleaning",
  CLOSEOUT_SECURITY_SERVICE = "Closeout Security",
  CLOSEOUT_SETUP_SERVICE = "Closeout Setup",
  PLACEHOLDER = "",
}

export type ActionDefinition = {
  // TODO: Fix this type
  action: () => any;
  optimisticNextStatus: BookingStatusLabel;
  confirmation?: boolean;
};

interface Props {
  calendarEventId: string;
  pageContext: PageContextLevel;
  status: BookingStatusLabel;
  startDate: Timestamp;
  reason: string;
}

export default function useBookingActions({
  calendarEventId,
  pageContext,
  status,
  startDate,
  reason,
}: Props) {
  const [date, setDate] = useState(new Date());
  const router = useRouter();
  const { tenant } = useParams();
  const { reloadExistingCalendarEvents } = useContext(BookingContext);
  const { userEmail, netId } = useContext(DatabaseContext);
  const loadExistingBookingData = useExistingBooking();
  const [bookingData, setBookingData] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<{
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  }>({});
  const [servicesApproved, setServicesApproved] = useState<{
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  }>({});
  const [servicesClosedOut, setServicesClosedOut] = useState<{
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  }>({});
  const [currentXState, setCurrentXState] = useState<any>("");

  // Function to fetch booking data and update states
  const fetchBookingData = useCallback(async () => {
    if (isMediaCommons(tenant as string) && calendarEventId) {
      try {
        const data = (await clientGetDataByCalendarEventId(
          TableNames.BOOKING,
          calendarEventId,
          tenant as string
        )) as any; // Type assertion to handle dynamic properties
        setBookingData(data);

        // Detect service requests from booking data
        if (data) {
          setServiceRequests(getMediaCommonsServices(data));

          // Get XState v5 information for service approval status
          if (data.xstateData) {
            // Use unified XState utilities
            const checker = createXStateChecker(data);
            const currentStateValue = checker.getCurrentStateString();
            setCurrentXState(currentStateValue);

            const context = getXStateContext(data) || {};
            setServicesApproved({
              staff:
                context.servicesApproved?.staff ?? data.staffServiceApproved,
              equipment:
                context.servicesApproved?.equipment ??
                data.equipmentServiceApproved,
              catering:
                context.servicesApproved?.catering ??
                data.cateringServiceApproved,
              cleaning:
                context.servicesApproved?.cleaning ??
                data.cleaningServiceApproved,
              security:
                context.servicesApproved?.security ??
                data.securityServiceApproved,
              setup:
                context.servicesApproved?.setup ?? data.setupServiceApproved,
            });

            // Detect service closeout completion from XState parallel states
            const serviceCloseoutStates =
              typeof currentStateValue === "object" &&
              currentStateValue &&
              currentStateValue["Service Closeout"]
                ? currentStateValue["Service Closeout"]
                : {};

            setServicesClosedOut({
              staff:
                serviceCloseoutStates["Staff Closeout"] === "Staff Closedout",
              equipment:
                serviceCloseoutStates["Equipment Closeout"] ===
                "Equipment Closedout",
              catering:
                serviceCloseoutStates["Catering Closeout"] ===
                "Catering Closedout",
              cleaning:
                serviceCloseoutStates["Cleaning Closeout"] ===
                "Cleaning Closedout",
              security:
                serviceCloseoutStates["Security Closeout"] ===
                "Security Closedout",
              setup:
                serviceCloseoutStates["Setup Closeout"] === "Setup Closedout",
            });
          } else {
            // Fallback to individual service approval fields if XState data is not available
            setCurrentXState("");
            setServicesApproved({
              staff: data.staffServiceApproved,
              equipment: data.equipmentServiceApproved,
              catering: data.cateringServiceApproved,
              cleaning: data.cleaningServiceApproved,
              security: data.securityServiceApproved,
              setup: data.setupServiceApproved,
            });
            setServicesClosedOut({}); // Reset closeout status if no XState data
          }
        }
      } catch (error) {
        console.error("Error fetching booking data:", error);
      }
    }
  }, [calendarEventId, tenant]);

  // Fetch booking data to detect service requests for Media Commons
  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  const updateActions = () => {
    setDate(new Date());
  };

  const baseActions = {
    [Actions.CANCEL]: {
      action: async () => {
        await cancel(calendarEventId, userEmail, netId, tenant as string);
      },
      optimisticNextStatus: BookingStatusLabel.CANCELED,
      confirmation: true,
    },
    [Actions.NO_SHOW]: {
      action: async () => {
        await noShow(calendarEventId, userEmail, netId, tenant as string);
      },
      optimisticNextStatus: BookingStatusLabel.NO_SHOW,
    },
    [Actions.CHECK_IN]: {
      action: async () => {
        await checkin(calendarEventId, userEmail, tenant as string);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
    },
    [Actions.CHECK_OUT]: {
      action: async () => {
        await checkOut(calendarEventId, userEmail, tenant as string);
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.FIRST_APPROVE]: {
      action: async () => {
        await clientApproveBooking(
          calendarEventId,
          userEmail,
          tenant as string
        );
      },
      optimisticNextStatus: BookingStatusLabel.PRE_APPROVED,
    },
    [Actions.FINAL_APPROVE]: {
      action: async () => {
        // For Media Commons, let XState handle the service approval flow
        // Pre-approved -> Services Request (if services requested) -> Approved (when services approved)
        await clientApproveBooking(
          calendarEventId,
          userEmail,
          tenant as string
        );
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.EQUIPMENT_APPROVE]: {
      action: async () => {
        await clientEquipmentApprove(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.APPROVED,
    },
    [Actions.SEND_TO_EQUIPMENT]: {
      action: async () => {
        await clientSendToEquipment(calendarEventId, userEmail);
      },
      optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
    },
    [Actions.DECLINE]: {
      action: async () => {
        await decline(calendarEventId, userEmail, reason, tenant as string);
      },
      optimisticNextStatus: BookingStatusLabel.DECLINED,
      confirmation: true,
    },
    [Actions.EDIT]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        reloadExistingCalendarEvents();
        router.push(`/${tenant}/edit/${calendarEventId}`);
      },
      optimisticNextStatus: status,
      confirmation: false,
    },
    [Actions.MODIFICATION]: {
      action: async () => {
        loadExistingBookingData(calendarEventId);
        reloadExistingCalendarEvents();
        router.push(`/${tenant}/modification/${calendarEventId}`);
      },
      optimisticNextStatus: status,
      confirmation: false,
    },
  };

  // Service types constant definition
  const SERVICE_TYPES = [
    "staff",
    "equipment",
    "catering",
    "cleaning",
    "security",
    "setup",
  ] as const;

  // Common action definition function
  const getActionsForPageContext = (
    pageContext: PageContextLevel
  ): Actions[] => {
    let options: Actions[] = [];

    // Common constants definition
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const thirtyPastStartTime =
      date.getTime() - startDate.toDate().getTime() >= THIRTY_MIN_MS;

    switch (pageContext) {
      case PageContextLevel.USER:
        // User actions
        if (
          status !== BookingStatusLabel.CANCELED &&
          status !== BookingStatusLabel.CHECKED_IN &&
          status !== BookingStatusLabel.CHECKED_OUT &&
          status !== BookingStatusLabel.CLOSED &&
          status !== BookingStatusLabel.NO_SHOW
        ) {
          options.push(Actions.CANCEL);
        }
        if (
          (status === BookingStatusLabel.REQUESTED ||
            status === BookingStatusLabel.DECLINED) &&
          startDate.toDate() > date
        ) {
          options.push(Actions.EDIT);
        }
        break;

      case PageContextLevel.PA:
        // PA actions
        if (status === BookingStatusLabel.APPROVED) {
          options.push(Actions.CHECK_IN);
          options.push(Actions.MODIFICATION);
        } else if (status === BookingStatusLabel.CHECKED_IN) {
          options.push(Actions.CHECK_OUT);
        } else if (status === BookingStatusLabel.NO_SHOW) {
          options.push(Actions.CHECK_IN);
        } else if (status === BookingStatusLabel.WALK_IN) {
          options.push(Actions.CHECK_OUT);
          options.push(Actions.MODIFICATION);
        }

        if (thirtyPastStartTime && status === BookingStatusLabel.APPROVED) {
          options.push(Actions.NO_SHOW);
        }
        break;

      case PageContextLevel.LIAISON:
        // Liaison actions
        options.push(Actions.DECLINE);
        if (status === BookingStatusLabel.REQUESTED) {
          options.push(Actions.FIRST_APPROVE);
        }
        break;

      case PageContextLevel.SERVICES:
        // Services actions
        if (
          status === BookingStatusLabel.DECLINED ||
          status === BookingStatusLabel.CLOSED ||
          status === BookingStatusLabel.CHECKED_OUT ||
          status === BookingStatusLabel.CANCELED
        ) {
          return [];
        }

        // Services context does not show basic actions (Cancel, Decline)
        options = [];

        // Use unified XState checker for consistent state checking
        const isInServicesRequest =
          (typeof currentXState === "object" &&
            currentXState &&
            currentXState["Services Request"]) ||
          (typeof currentXState === "string" &&
            (currentXState.includes("Services Request") ||
              currentXState === "Services Request"));

        // For Media Commons, provide actions only when service requests exist
        if (
          isMediaCommons(tenant as string) &&
          Object.values(serviceRequests).some(Boolean) &&
          isInServicesRequest
        ) {
          const addServiceActions = (
            serviceType: keyof typeof serviceRequests,
            approveAction: Actions,
            declineAction: Actions
          ) => {
            if (
              serviceRequests[serviceType] &&
              servicesApproved[serviceType] === undefined
            ) {
              options.push(approveAction);
              options.push(declineAction);
            }
          };

          SERVICE_TYPES.forEach((serviceType) => {
            // Direct enum value mapping to avoid string literal issues
            let approveAction: Actions;
            let declineAction: Actions;

            switch (serviceType) {
              case "staff":
                approveAction = Actions.APPROVE_STAFF_SERVICE;
                declineAction = Actions.DECLINE_STAFF_SERVICE;
                break;
              case "equipment":
                approveAction = Actions.APPROVE_EQUIPMENT_SERVICE;
                declineAction = Actions.DECLINE_EQUIPMENT_SERVICE;
                break;
              case "catering":
                approveAction = Actions.APPROVE_CATERING_SERVICE;
                declineAction = Actions.DECLINE_CATERING_SERVICE;
                break;
              case "cleaning":
                approveAction = Actions.APPROVE_CLEANING_SERVICE;
                declineAction = Actions.DECLINE_CLEANING_SERVICE;
                break;
              case "security":
                approveAction = Actions.APPROVE_SECURITY_SERVICE;
                declineAction = Actions.DECLINE_SECURITY_SERVICE;
                break;
              case "setup":
                approveAction = Actions.APPROVE_SETUP_SERVICE;
                declineAction = Actions.DECLINE_SETUP_SERVICE;
                break;
              default:
                return; // Skip unknown service types
            }

            addServiceActions(serviceType, approveAction, declineAction);
          });
        }
        break;

      default: // ADMIN
        if (
          status === BookingStatusLabel.DECLINED ||
          status === BookingStatusLabel.CLOSED ||
          (status === BookingStatusLabel.CHECKED_OUT &&
            !isMediaCommons(tenant as string)) ||
          (status === BookingStatusLabel.CANCELED &&
            !(
              isMediaCommons(tenant as string) &&
              Object.values(serviceRequests).some(Boolean)
            ))
        ) {
          return [];
        }

        // Basic approval actions
        if (status === BookingStatusLabel.REQUESTED) {
          options.push(Actions.FIRST_APPROVE);
        } else if (status === BookingStatusLabel.PRE_APPROVED) {
          const isInServiceRequest =
            (typeof currentXState === "object" &&
              currentXState &&
              currentXState["Services Request"]) ||
            (typeof currentXState === "string" &&
              (currentXState.includes("Services Request") ||
                currentXState === "Services Request"));

          if (!isInServiceRequest) {
            options.push(Actions.FINAL_APPROVE);
          }
        } else if (status === BookingStatusLabel.EQUIPMENT) {
          options.push(Actions.FINAL_APPROVE);
        }

        // Service-related actions (only in Services Request state)
        const adminIsInServicesRequest =
          (typeof currentXState === "object" &&
            currentXState &&
            currentXState["Services Request"]) ||
          (typeof currentXState === "string" &&
            (currentXState.includes("Services Request") ||
              currentXState === "Services Request"));

        if (
          isMediaCommons(tenant as string) &&
          Object.values(serviceRequests).some(Boolean) &&
          adminIsInServicesRequest
        ) {
          const addServiceActions = (
            serviceType: keyof typeof serviceRequests,
            approveAction: Actions,
            declineAction: Actions
          ) => {
            if (
              serviceRequests[serviceType] &&
              servicesApproved[serviceType] === undefined
            ) {
              options.push(approveAction);
              options.push(declineAction);
            }
          };

          SERVICE_TYPES.forEach((serviceType) => {
            // Use enum values (not enum names) to match the action keys
            const approveAction =
              Actions[
                `APPROVE_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
              ];
            const declineAction =
              Actions[
                `DECLINE_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
              ];
            addServiceActions(serviceType, approveAction, declineAction);
          });
        }

        // Service closeout actions
        const isInServiceCloseout =
          (typeof currentXState === "object" &&
            currentXState &&
            currentXState["Service Closeout"]) ||
          (typeof currentXState === "string" &&
            currentXState.includes("Service Closeout"));

        if (
          isMediaCommons(tenant as string) &&
          (isInServiceCloseout ||
            (Object.values(servicesApproved).some(Boolean) &&
              (status === BookingStatusLabel.CHECKED_OUT ||
                status === BookingStatusLabel.CANCELED ||
                status === BookingStatusLabel.NO_SHOW ||
                (typeof currentXState === "string" &&
                  currentXState === "Checked Out"))))
        ) {
          SERVICE_TYPES.forEach((serviceType) => {
            if (
              serviceRequests[serviceType] &&
              servicesApproved[serviceType] === true &&
              servicesClosedOut[serviceType] !== true
            ) {
              const closeoutAction =
                Actions[
                  `CLOSEOUT_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
                ];
              options.push(closeoutAction);
            }
          });
        }

        // Add PA options
        if (status === BookingStatusLabel.APPROVED) {
          options.push(Actions.CHECK_IN);
          options.push(Actions.MODIFICATION);
        } else if (status === BookingStatusLabel.CHECKED_IN) {
          options.push(Actions.CHECK_OUT);
        } else if (status === BookingStatusLabel.NO_SHOW) {
          options.push(Actions.CHECK_IN);
        } else if (status === BookingStatusLabel.WALK_IN) {
          options.push(Actions.CHECK_OUT);
          options.push(Actions.MODIFICATION);
        }

        if (thirtyPastStartTime && status === BookingStatusLabel.APPROVED) {
          options.push(Actions.NO_SHOW);
        }

        // Do not show Cancel and Decline for CHECKED_OUT and CANCELED states
        if (
          status !== BookingStatusLabel.CHECKED_OUT &&
          status !== BookingStatusLabel.CANCELED
        ) {
          options.push(Actions.CANCEL);
          options.push(Actions.DECLINE);
        }
        break;
    }

    return options;
  };

  // Service-related generic processing function
  const executeServiceAction = async (
    serviceType: keyof typeof serviceRequests,
    action: "approve" | "decline" | "closeout",
    reason?: string
  ) => {
    // Check if service is actually requested (for approve and closeout actions)
    if (action === "approve" && !serviceRequests[serviceType]) {
      console.warn(`${serviceType} service not requested, skipping approval`);
      return;
    }

    if (
      action === "closeout" &&
      (!serviceRequests[serviceType] || servicesApproved[serviceType] !== true)
    ) {
      console.warn(
        `${serviceType} service not approved or not requested, skipping closeout`
      );
      return;
    }

    // When transition from Pre-approved to Services Request state is needed
    if (
      (action === "approve" || action === "decline") &&
      currentXState === "Pre-approved" &&
      Object.values(serviceRequests).some(Boolean)
    ) {
      await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant as string,
        },
        body: JSON.stringify({
          calendarEventId,
          eventType: "approve",
          email: userEmail,
        }),
      });
    }

    // State check for decline action
    if (
      action === "decline" &&
      (currentXState === "Pre-approved" || currentXState === "Requested")
    ) {
      await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant as string,
        },
        body: JSON.stringify({
          calendarEventId,
          eventType: "approve",
          email: userEmail,
        }),
      });
    }

    // Execute service action
    await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant as string,
      },
      body: JSON.stringify({
        calendarEventId,
        serviceType,
        action,
        email: userEmail,
        ...(reason && { reason }),
      }),
    });

    // When declining, other services are automatically declined
    // Manual auto-decline is not needed as XState state machine handles it automatically

    await fetchBookingData();
  };

  // Function to dynamically generate service actions
  const createServiceActions = () => {
    const serviceActions: Partial<Record<Actions, ActionDefinition>> = {};

    SERVICE_TYPES.forEach((serviceType) => {
      const capitalizedType =
        serviceType.charAt(0).toUpperCase() + serviceType.slice(1);

      // Approve actions
      const approveAction =
        `APPROVE_${serviceType.toUpperCase()}_SERVICE` as Actions;
      serviceActions[approveAction] = {
        action: () => executeServiceAction(serviceType, "approve"),
        optimisticNextStatus: BookingStatusLabel.PENDING,
      };

      // Decline actions
      const declineAction =
        `DECLINE_${serviceType.toUpperCase()}_SERVICE` as Actions;
      serviceActions[declineAction] = {
        action: () =>
          executeServiceAction(
            serviceType,
            "decline",
            reason || `${capitalizedType} service declined`
          ),
        optimisticNextStatus: BookingStatusLabel.PENDING,
        confirmation: true,
      };

      // Closeout actions
      const closeoutAction =
        `CLOSEOUT_${serviceType.toUpperCase()}_SERVICE` as Actions;
      serviceActions[closeoutAction] = {
        action: () => executeServiceAction(serviceType, "closeout"),
        optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
      };
    });

    return serviceActions;
  };

  // Create all service actions regardless of tenant for testing compatibility
  const createAllServiceActions = () => {
    const serviceActions: Record<string, ActionDefinition> = {};

    SERVICE_TYPES.forEach((serviceType) => {
      const capitalizedType =
        serviceType.charAt(0).toUpperCase() + serviceType.slice(1);

      // Approve actions - use the enum value directly as key for proper enum-based matching
      const approveActionKey =
        Actions[
          `APPROVE_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
        ];
      serviceActions[approveActionKey] = {
        action: () => executeServiceAction(serviceType, "approve"),
        optimisticNextStatus: BookingStatusLabel.PENDING,
      };

      // Decline actions - use the enum value directly as key for proper enum-based matching
      const declineActionKey =
        Actions[
          `DECLINE_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
        ];
      serviceActions[declineActionKey] = {
        action: () =>
          executeServiceAction(
            serviceType,
            "decline",
            reason || `${capitalizedType} service declined`
          ),
        optimisticNextStatus: BookingStatusLabel.PENDING,
        confirmation: true,
      };

      // Closeout actions - use the enum value directly as key for proper enum-based matching
      const closeoutActionKey =
        Actions[
          `CLOSEOUT_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
        ];
      serviceActions[closeoutActionKey] = {
        action: () => executeServiceAction(serviceType, "closeout"),
        optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
      };
    });

    return serviceActions;
  };

  // Merge base actions with service actions
  const serviceActions = createAllServiceActions();
  const actions = {
    ...baseActions,
    ...serviceActions,
    // never used, just make typescript happy
    [Actions.PLACEHOLDER]: {
      action: async () => {},
      optimisticNextStatus: BookingStatusLabel.UNKNOWN,
    },
  };

  // Get options for each PageContextLevel using common function
  const allOptions = useMemo(() => {
    return getActionsForPageContext(pageContext);
  }, [
    pageContext,
    status,
    startDate,
    date,
    tenant,
    serviceRequests,
    servicesApproved,
    servicesClosedOut,
    currentXState,
  ]);

  const options = () => {
    return allOptions;
  };

  return { actions, updateActions, options };
}
