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
          if (data.xstateData?.snapshot) {
            // XState v5: Get current state and context from snapshot
            const currentStateValue = data.xstateData.snapshot.value || "";
            setCurrentXState(currentStateValue);

            const context = data.xstateData.snapshot.context || {};
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

  const autoDeclineRemainingServices = async (
    excludeService?: string,
    declineReason?: string
  ) => {
    const servicesToAutoDecline = [];

    if (
      excludeService !== "catering" &&
      serviceRequests.catering &&
      servicesApproved.catering === undefined
    ) {
      servicesToAutoDecline.push("declineCatering");
    }
    if (
      excludeService !== "cleaning" &&
      serviceRequests.cleaning &&
      servicesApproved.cleaning === undefined
    ) {
      servicesToAutoDecline.push("declineCleaning");
    }
    if (
      excludeService !== "security" &&
      serviceRequests.security &&
      servicesApproved.security === undefined
    ) {
      servicesToAutoDecline.push("declineSecurity");
    }
    if (
      excludeService !== "equipment" &&
      serviceRequests.equipment &&
      servicesApproved.equipment === undefined
    ) {
      servicesToAutoDecline.push("declineEquipment");
    }
    if (
      excludeService !== "staff" &&
      serviceRequests.staff &&
      servicesApproved.staff === undefined
    ) {
      servicesToAutoDecline.push("declineStaff");
    }
    if (
      excludeService !== "setup" &&
      serviceRequests.setup &&
      servicesApproved.setup === undefined
    ) {
      servicesToAutoDecline.push("declineSetup");
    }

    // Execute auto-decline for pending services
    for (const declineEvent of servicesToAutoDecline) {
      await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant as string,
        },
        body: JSON.stringify({
          calendarEventId,
          eventType: declineEvent,
          email: userEmail,
          reason: declineReason || "Service declined (auto-decline)",
        }),
      });
    }
  };

  // Merge base actions with service actions
  const actions = {
    ...baseActions,
    // Media Commons Service Actions
    [Actions.APPROVE_STAFF_SERVICE]: {
      action: async () => {
        // Check if staff service is actually requested
        if (!serviceRequests.staff) {
          console.warn("Staff service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for staff service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "staff",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_EQUIPMENT_SERVICE]: {
      action: async () => {
        // Check if equipment service is actually requested
        if (!serviceRequests.equipment) {
          console.warn("Equipment service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for equipment service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "equipment",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_CATERING_SERVICE]: {
      action: async () => {
        // Check if catering service is actually requested
        if (!serviceRequests.catering) {
          console.warn("Catering service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for catering service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "catering",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_CLEANING_SERVICE]: {
      action: async () => {
        // Check if cleaning service is actually requested
        if (!serviceRequests.cleaning) {
          console.warn("Cleaning service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for cleaning service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "cleaning",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_SECURITY_SERVICE]: {
      action: async () => {
        // Check if security service is actually requested
        if (!serviceRequests.security) {
          console.warn("Security service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for security service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "security",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_SETUP_SERVICE]: {
      action: async () => {
        // Check if setup service is actually requested
        if (!serviceRequests.setup) {
          console.warn("Setup service not requested, skipping approval");
          return;
        }

        // If we're in Pre-approved state and services are requested, first transition to Services Request
        if (
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

        // Use new services API for setup service approval
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "setup",
            action: "approve",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.DECLINE_STAFF_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Use new services API for staff service decline
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "staff",
            action: "decline",
            email: userEmail,
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        await autoDeclineRemainingServices(
          "staff",
          reason || "Staff service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_EQUIPMENT_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Use new services API for equipment service decline
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "equipment",
            action: "decline",
            email: userEmail,
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        await autoDeclineRemainingServices(
          "equipment",
          reason || "Equipment service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_CATERING_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Then decline the specific catering service
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "catering",
            action: "decline",
            email: userEmail,
            reason: reason || "Catering service declined",
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        await autoDeclineRemainingServices(
          "catering",
          reason || "Catering service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_CLEANING_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Then decline the specific cleaning service
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "cleaning",
            action: "decline",
            email: userEmail,
            reason: reason || "Cleaning service declined",
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        await autoDeclineRemainingServices(
          "cleaning",
          reason || "Cleaning service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_SECURITY_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Then decline the specific security service
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "security",
            action: "decline",
            email: userEmail,
            reason: reason || "Security service declined",
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        await autoDeclineRemainingServices(
          "security",
          reason || "Security service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_SETUP_SERVICE]: {
      action: async () => {
        // First ensure we're in Services Request state if needed
        if (currentXState === "Pre-approved" || currentXState === "Requested") {
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

        // Then decline the specific setup service
        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "setup",
            action: "decline",
            email: userEmail,
            reason: reason || "Setup service declined",
          }),
        });

        // Auto-decline other pending services to complete the parallel state
        // This ensures the booking transitions to Declined immediately
        await autoDeclineRemainingServices(
          "setup",
          reason || "Setup service declined - other services auto-declined"
        );

        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    // Media Commons Service Closeout Actions
    [Actions.CLOSEOUT_STAFF_SERVICE]: {
      action: async () => {
        // Check if staff service was approved and needs closeout
        if (!serviceRequests.staff || servicesApproved.staff !== true) {
          console.warn(
            "Staff service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "staff",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_EQUIPMENT_SERVICE]: {
      action: async () => {
        // Check if equipment service was approved and needs closeout
        if (!serviceRequests.equipment || servicesApproved.equipment !== true) {
          console.warn(
            "Equipment service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "equipment",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_CATERING_SERVICE]: {
      action: async () => {
        // Check if catering service was approved and needs closeout
        if (!serviceRequests.catering || servicesApproved.catering !== true) {
          console.warn(
            "Catering service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "catering",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_CLEANING_SERVICE]: {
      action: async () => {
        // Check if cleaning service was approved and needs closeout
        if (!serviceRequests.cleaning || servicesApproved.cleaning !== true) {
          console.warn(
            "Cleaning service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "cleaning",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_SECURITY_SERVICE]: {
      action: async () => {
        // Check if security service was approved and needs closeout
        if (!serviceRequests.security || servicesApproved.security !== true) {
          console.warn(
            "Security service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "security",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_SETUP_SERVICE]: {
      action: async () => {
        // Check if setup service was approved and needs closeout
        if (!serviceRequests.setup || servicesApproved.setup !== true) {
          console.warn(
            "Setup service not approved or not requested, skipping closeout"
          );
          return;
        }

        await fetch("/api/services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            serviceType: "setup",
            action: "closeout",
            email: userEmail,
          }),
        });
        // Refresh booking data to update UI
        await fetchBookingData();
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    // never used, just make typescript happy
    [Actions.PLACEHOLDER]: {
      action: async () => {},
      optimisticNextStatus: BookingStatusLabel.UNKNOWN,
    },
  };

  const userOptions = useMemo(() => {
    let options = [];
    if (
      status !== BookingStatusLabel.CANCELED &&
      status !== BookingStatusLabel.CHECKED_IN &&
      status !== BookingStatusLabel.CHECKED_OUT &&
      status !== BookingStatusLabel.CLOSED &&
      status !== BookingStatusLabel.NO_SHOW
    ) {
      options.push(Actions.CANCEL);
    }
    // Allow EDIT for REQUESTED and DECLINED bookings (if future date)
    if (
      (status === BookingStatusLabel.REQUESTED ||
        status === BookingStatusLabel.DECLINED) &&
      startDate.toDate() > date
    ) {
      options.push(Actions.EDIT);
    }
    return options;
  }, [status]);

  const paOptions = useMemo(() => {
    let options = [];

    if (status === BookingStatusLabel.APPROVED) {
      options.push(Actions.CHECK_IN);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.CHECKED_IN) {
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
    } else if (status === BookingStatusLabel.NO_SHOW) {
      options.push(Actions.CHECK_IN);
    } else if (status === BookingStatusLabel.WALK_IN) {
      options.push(Actions.CHECK_OUT);
      options.push(Actions.MODIFICATION);
    }

    const THIRTY_MIN_MS = 30 * 60 * 1000;
    const thirtyPastStartTime =
      date.getTime() - startDate.toDate().getTime() >= THIRTY_MIN_MS;
    if (
      thirtyPastStartTime &&
      (status === BookingStatusLabel.APPROVED ||
        status === BookingStatusLabel.CHECKED_IN)
    ) {
      options.push(Actions.NO_SHOW);
    }

    return options;
  }, [status]);

  const liaisonOptions = [Actions.FIRST_APPROVE, Actions.DECLINE];
  const equipmentOptions = [
    Actions.MODIFICATION,
    Actions.EQUIPMENT_APPROVE,
    Actions.DECLINE,
  ];

  const adminOptions = useMemo(() => {
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

    let options: Actions[] = [];
    if (status === BookingStatusLabel.REQUESTED) {
      options.push(Actions.FIRST_APPROVE);
      // No SEND_TO_EQUIPMENT for REQUESTED status
    } else if (status === BookingStatusLabel.PRE_APPROVED) {
      // Only show FINAL_APPROVE if not in Service Request state
      const isInServiceRequest =
        (typeof currentXState === "object" &&
          currentXState &&
          currentXState["Services Request"]) ||
        (typeof currentXState === "string" &&
          (currentXState.includes("Services Request") ||
            currentXState === "Services Request"));

      // Show FINAL_APPROVE if not in Service Request state
      // In Pre-approved state, we should show FINAL_APPROVE even if there are unapproved services
      // because the 2nd approve will transition to Services Request state where services can be approved
      if (!isInServiceRequest) {
        options.push(Actions.FINAL_APPROVE);
      }
    } else if (status === BookingStatusLabel.EQUIPMENT) {
      options.push(Actions.FINAL_APPROVE);
    }

    // Add Media Commons service approval options - only show when in Services Request state
    console.log(`🔍 DEBUG SERVICES REQUEST DETECTION:`, {
      calendarEventId,
      currentXState,
      currentXStateType: typeof currentXState,
      currentXStateKeys:
        typeof currentXState === "object" && currentXState
          ? Object.keys(currentXState)
          : null,
      hasServicesRequestKey:
        typeof currentXState === "object" &&
        currentXState &&
        currentXState["Services Request"],
      isString: typeof currentXState === "string",
      includesServicesRequest:
        typeof currentXState === "string" &&
        currentXState.includes("Services Request"),
      equalsServicesRequest:
        typeof currentXState === "string" &&
        currentXState === "Services Request",
    });

    const isInServicesRequest =
      (typeof currentXState === "object" &&
        currentXState &&
        currentXState["Services Request"]) ||
      (typeof currentXState === "string" &&
        (currentXState.includes("Services Request") ||
          currentXState === "Services Request"));

    console.log(`🔍 SERVICES REQUEST DETECTION RESULT:`, {
      calendarEventId,
      isInServicesRequest,
      hasServiceRequests: Object.values(serviceRequests).some(Boolean),
      willShowServiceActions:
        isMediaCommons(tenant as string) &&
        Object.values(serviceRequests).some(Boolean) &&
        isInServicesRequest,
    });

    if (
      isMediaCommons(tenant as string) &&
      Object.values(serviceRequests).some(Boolean) &&
      isInServicesRequest
    ) {
      // Add service approval actions based on what's requested and current state
      // Only show actions for services that are requested but not yet decided (undefined)
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

      addServiceActions(
        "staff",
        Actions.APPROVE_STAFF_SERVICE,
        Actions.DECLINE_STAFF_SERVICE
      );
      addServiceActions(
        "equipment",
        Actions.APPROVE_EQUIPMENT_SERVICE,
        Actions.DECLINE_EQUIPMENT_SERVICE
      );
      addServiceActions(
        "catering",
        Actions.APPROVE_CATERING_SERVICE,
        Actions.DECLINE_CATERING_SERVICE
      );
      addServiceActions(
        "cleaning",
        Actions.APPROVE_CLEANING_SERVICE,
        Actions.DECLINE_CLEANING_SERVICE
      );
      addServiceActions(
        "security",
        Actions.APPROVE_SECURITY_SERVICE,
        Actions.DECLINE_SECURITY_SERVICE
      );
      addServiceActions(
        "setup",
        Actions.APPROVE_SETUP_SERVICE,
        Actions.DECLINE_SETUP_SERVICE
      );
    }

    // Add Media Commons service closeout options
    // Show closeout actions when in Service Closeout state or when services are approved and booking is completed
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
      if (
        serviceRequests.staff &&
        servicesApproved.staff === true &&
        servicesClosedOut.staff !== true
      ) {
        options.push(Actions.CLOSEOUT_STAFF_SERVICE);
      }
      if (
        serviceRequests.equipment &&
        servicesApproved.equipment === true &&
        servicesClosedOut.equipment !== true
      ) {
        options.push(Actions.CLOSEOUT_EQUIPMENT_SERVICE);
      }
      if (
        serviceRequests.catering &&
        servicesApproved.catering === true &&
        servicesClosedOut.catering !== true
      ) {
        options.push(Actions.CLOSEOUT_CATERING_SERVICE);
      }
      if (
        serviceRequests.cleaning &&
        servicesApproved.cleaning === true &&
        servicesClosedOut.cleaning !== true
      ) {
        options.push(Actions.CLOSEOUT_CLEANING_SERVICE);
      }
      if (
        serviceRequests.security &&
        servicesApproved.security === true &&
        servicesClosedOut.security !== true
      ) {
        options.push(Actions.CLOSEOUT_SECURITY_SERVICE);
      }
      if (
        serviceRequests.setup &&
        servicesApproved.setup === true &&
        servicesClosedOut.setup !== true
      ) {
        options.push(Actions.CLOSEOUT_SETUP_SERVICE);
      }
    }

    options = options.concat(paOptions);

    // Don't show Cancel and Decline for CHECKED_OUT and CANCELED status (CLOSED is already handled by early return)
    if (
      status !== BookingStatusLabel.CHECKED_OUT &&
      status !== BookingStatusLabel.CANCELED
    ) {
      options.push(Actions.CANCEL);
      options.push(Actions.DECLINE);
    }

    return options;
  }, [
    status,
    paOptions,
    date,
    tenant,
    serviceRequests,
    servicesApproved,
    servicesClosedOut,
    currentXState,
  ]);

  const options = () => {
    switch (pageContext) {
      case PageContextLevel.USER:
        return userOptions;
      case PageContextLevel.PA:
        return paOptions;
      case PageContextLevel.LIAISON:
        return liaisonOptions;
      case PageContextLevel.EQUIPMENT:
        return equipmentOptions;
      default:
        return adminOptions;
    }
  };

  return { actions, updateActions, options };
}
