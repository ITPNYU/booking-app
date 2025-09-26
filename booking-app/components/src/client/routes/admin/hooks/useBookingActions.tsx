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
            // Use common helper to get current state and context
            const { getXStateValue, getXStateContext } = await import(
              "@/components/src/utils/xstateHelpers"
            );
            const currentStateValue = getXStateValue(data) || "";
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

  // サービスタイプの定数定義
  const SERVICE_TYPES = [
    "staff",
    "equipment",
    "catering",
    "cleaning",
    "security",
    "setup",
  ] as const;

  // 共通のアクション定義関数
  const getActionsForPageContext = (
    pageContext: PageContextLevel
  ): Actions[] => {
    let options: Actions[] = [];

    // 共通の定数定義
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const thirtyPastStartTime =
      date.getTime() - startDate.toDate().getTime() >= THIRTY_MIN_MS;

    switch (pageContext) {
      case PageContextLevel.USER:
        // ユーザー用アクション
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
        // PA用アクション
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
        // Liaison用アクション
        options.push(Actions.DECLINE);
        if (status === BookingStatusLabel.REQUESTED) {
          options.push(Actions.FIRST_APPROVE);
        }
        break;

      case PageContextLevel.EQUIPMENT:
        // Equipment用アクション（固定）
        options = [
          Actions.MODIFICATION,
          Actions.EQUIPMENT_APPROVE,
          Actions.DECLINE,
        ];
        break;

      case PageContextLevel.STAFFING:
        // Staffing用アクション
        if (
          status === BookingStatusLabel.DECLINED ||
          status === BookingStatusLabel.CLOSED ||
          status === BookingStatusLabel.CHECKED_OUT ||
          status === BookingStatusLabel.CANCELED
        ) {
          return [];
        }

        const isInServicesRequest =
          (typeof currentXState === "object" &&
            currentXState &&
            currentXState["Services Request"]) ||
          (typeof currentXState === "string" &&
            (currentXState.includes("Services Request") ||
              currentXState === "Services Request"));

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
            const approveAction =
              `APPROVE_${serviceType.toUpperCase()}_SERVICE` as Actions;
            const declineAction =
              `DECLINE_${serviceType.toUpperCase()}_SERVICE` as Actions;
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

        // 基本的なapprovalアクション
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

        // サービス関連のアクション（Services Request状態の時のみ）
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
            const approveAction =
              `APPROVE_${serviceType.toUpperCase()}_SERVICE` as Actions;
            const declineAction =
              `DECLINE_${serviceType.toUpperCase()}_SERVICE` as Actions;
            addServiceActions(serviceType, approveAction, declineAction);
          });
        }

        // サービスcloseoutアクション
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
                `CLOSEOUT_${serviceType.toUpperCase()}_SERVICE` as Actions;
              options.push(closeoutAction);
            }
          });
        }

        // PAオプションを追加
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

        // CHECKED_OUTとCANCELED状態ではCancelとDeclineを表示しない
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

  // サービス関連の汎用処理関数
  const executeServiceAction = async (
    serviceType: keyof typeof serviceRequests,
    action: "approve" | "decline" | "closeout",
    reason?: string
  ) => {
    // サービスが実際にリクエストされているかチェック（approveとcloseoutの場合）
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

    // Pre-approvedからServices Request状態への移行が必要な場合
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

    // decline時は状態チェック
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

    // サービスアクションの実行
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

    // decline時は他のサービスも自動的にdecline
    // XStateの状態機械が自動的に処理するため、手動でのauto-declineは不要

    await fetchBookingData();
  };

  // サービスアクションを動的に生成する関数
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

      // Approve actions - use the enum value as key
      const approveActionKey =
        Actions[
          `APPROVE_${serviceType.toUpperCase()}_SERVICE` as keyof typeof Actions
        ];
      serviceActions[approveActionKey] = {
        action: () => executeServiceAction(serviceType, "approve"),
        optimisticNextStatus: BookingStatusLabel.PENDING,
      };

      // Decline actions - use the enum value as key
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

      // Closeout actions - use the enum value as key
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

  // 各PageContextLevelのオプションを共通関数で取得
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
