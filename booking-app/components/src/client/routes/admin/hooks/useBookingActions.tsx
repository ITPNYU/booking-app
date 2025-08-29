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
import { clientGetDataByCalendarEventId } from "@/components/src/server/admin";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { useContext, useMemo, useState, useEffect } from "react";

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
  FINAL_APPROVE = "Final Approve",
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
  const [currentXState, setCurrentXState] = useState<string>("");

  // Fetch booking data to detect service requests for Media Commons
  useEffect(() => {
    const fetchBookingData = async () => {
      if (tenant === "mediaCommons" && calendarEventId) {
        try {
          const data = await clientGetDataByCalendarEventId(
            TableNames.BOOKING,
            calendarEventId,
            tenant as string
          );
          setBookingData(data);
          
          // Detect service requests from booking data
          if (data) {
            setServiceRequests({
              staff: !!data.staffService,
              equipment: !!data.equipmentService,
              catering: !!data.cateringService,
              cleaning: !!data.cleaningService,
              security: !!data.securityService,
              setup: !!data.setupService,
            });
            
            // Get XState information for service approval status
            if (data.xstateData) {
              setCurrentXState(data.xstateData.currentState || "");
              
              // Extract services approved status from XState context
              const context = data.xstateData.context || {};
              setServicesApproved({
                staff: context.servicesApproved?.staff,
                equipment: context.servicesApproved?.equipment,
                catering: context.servicesApproved?.catering,
                cleaning: context.servicesApproved?.cleaning,
                security: context.servicesApproved?.security,
                setup: context.servicesApproved?.setup,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching booking data:', error);
        }
      }
    };

    fetchBookingData();
  }, [calendarEventId, tenant]);

  const updateActions = () => {
    setDate(new Date());
  };

  const actions: { [key in Actions]: ActionDefinition } = {
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
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.FINAL_APPROVE]: {
      action: async () => {
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
    // Media Commons Service Actions
    [Actions.APPROVE_STAFF_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveStaff',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_EQUIPMENT_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveEquipment',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_CATERING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveCatering',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_CLEANING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveCleaning',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_SECURITY_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveSecurity',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.APPROVE_SETUP_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'approveSetup',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
    },
    [Actions.DECLINE_STAFF_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineStaff',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_EQUIPMENT_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineEquipment',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_CATERING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineCatering',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_CLEANING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineCleaning',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_SECURITY_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineSecurity',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    [Actions.DECLINE_SETUP_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'declineSetup',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.PENDING,
      confirmation: true,
    },
    // Media Commons Service Closeout Actions
    [Actions.CLOSEOUT_STAFF_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutStaff',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_EQUIPMENT_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutEquipment',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_CATERING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutCatering',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_CLEANING_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutCleaning',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_SECURITY_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutSecurity',
            email: userEmail,
          }),
        });
      },
      optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
    },
    [Actions.CLOSEOUT_SETUP_SERVICE]: {
      action: async () => {
        await fetch('/api/xstate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant': tenant as string,
          },
          body: JSON.stringify({
            calendarEventId,
            eventType: 'closeoutSetup',
            email: userEmail,
          }),
        });
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
      status !== BookingStatusLabel.NO_SHOW
    ) {
      options.push(Actions.CANCEL);
    }
    if (status == BookingStatusLabel.REQUESTED && startDate.toDate() > date) {
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
      status === BookingStatusLabel.CANCELED ||
      status === BookingStatusLabel.DECLINED ||
      status === BookingStatusLabel.CHECKED_OUT
    ) {
      return [];
    }

    let options: Actions[] = [];
    if (status === BookingStatusLabel.REQUESTED) {
      options.push(Actions.FIRST_APPROVE);
      // No SEND_TO_EQUIPMENT for REQUESTED status
    } else if (status === BookingStatusLabel.PENDING) {
      options.push(Actions.FINAL_APPROVE);
      options.push(Actions.SEND_TO_EQUIPMENT); // Only show for PENDING status
    } else if (status === BookingStatusLabel.EQUIPMENT) {
      options.push(Actions.FINAL_APPROVE);
    }

    // Add Media Commons service approval options
    if (tenant === "mediaCommons" && Object.values(serviceRequests).some(Boolean)) {
      // Add service approval actions based on what's requested and current state
      if (serviceRequests.staff && servicesApproved.staff !== true) {
        options.push(Actions.APPROVE_STAFF_SERVICE);
        options.push(Actions.DECLINE_STAFF_SERVICE);
      }
      if (serviceRequests.equipment && servicesApproved.equipment !== true) {
        options.push(Actions.APPROVE_EQUIPMENT_SERVICE);
        options.push(Actions.DECLINE_EQUIPMENT_SERVICE);
      }
      if (serviceRequests.catering && servicesApproved.catering !== true) {
        options.push(Actions.APPROVE_CATERING_SERVICE);
        options.push(Actions.DECLINE_CATERING_SERVICE);
      }
      if (serviceRequests.cleaning && servicesApproved.cleaning !== true) {
        options.push(Actions.APPROVE_CLEANING_SERVICE);
        options.push(Actions.DECLINE_CLEANING_SERVICE);
      }
      if (serviceRequests.security && servicesApproved.security !== true) {
        options.push(Actions.APPROVE_SECURITY_SERVICE);
        options.push(Actions.DECLINE_SECURITY_SERVICE);
      }
      if (serviceRequests.setup && servicesApproved.setup !== true) {
        options.push(Actions.APPROVE_SETUP_SERVICE);
        options.push(Actions.DECLINE_SETUP_SERVICE);
      }
    }

    // Add Media Commons service closeout options
    // Show closeout actions when booking is checked out or in Service Closeout state
    // and services were approved and need closeout
    if (
      tenant === "mediaCommons" &&
      (status === BookingStatusLabel.CHECKED_OUT || currentXState === "Service Closeout") &&
      Object.values(servicesApproved).some(Boolean)
    ) {
      if (serviceRequests.staff && servicesApproved.staff === true) {
        options.push(Actions.CLOSEOUT_STAFF_SERVICE);
      }
      if (serviceRequests.equipment && servicesApproved.equipment === true) {
        options.push(Actions.CLOSEOUT_EQUIPMENT_SERVICE);
      }
      if (serviceRequests.catering && servicesApproved.catering === true) {
        options.push(Actions.CLOSEOUT_CATERING_SERVICE);
      }
      if (serviceRequests.cleaning && servicesApproved.cleaning === true) {
        options.push(Actions.CLOSEOUT_CLEANING_SERVICE);
      }
      if (serviceRequests.security && servicesApproved.security === true) {
        options.push(Actions.CLOSEOUT_SECURITY_SERVICE);
      }
      if (serviceRequests.setup && servicesApproved.setup === true) {
        options.push(Actions.CLOSEOUT_SETUP_SERVICE);
      }
    }

    options = options.concat(paOptions);
    options.push(Actions.CANCEL);
    options.push(Actions.DECLINE);
    return options;
  }, [status, paOptions, date, tenant, serviceRequests, servicesApproved, currentXState]);

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
