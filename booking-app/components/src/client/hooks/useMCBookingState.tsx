import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { machine as mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { Timestamp } from "firebase/firestore";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Actor, createActor } from "xstate";
import { TableNames } from "../../policy";
import { BookingStatusLabel } from "../../types";
import { DatabaseContext } from "../routes/components/Provider";

interface BookingData {
  setupDetails?: string;
  mediaServices?: string;
  cateringService?: string;
  hireSecurity?: string;
  tenant?: string;
  xstateSnapshot?: string;
}

export const useMCBookingState = (
  calendarEventId: string,
  bookingData: BookingData
) => {
  const [actor, setActor] = useState<Actor<typeof mcBookingMachine> | null>(
    null
  );
  const [currentState, setCurrentState] = useState<any>(null);
  const [bookingStatus, setBookingStatus] = useState<BookingStatusLabel>(
    BookingStatusLabel.REQUESTED
  );
  const { userEmail } = useContext(DatabaseContext);
  const lastPersistedStateRef = useRef<string>("");

  // Memoize booking data to prevent unnecessary re-renders
  const memoizedBookingData = useMemo(
    () => ({
      setupDetails: bookingData.setupDetails,
      mediaServices: bookingData.mediaServices,
      cateringService: bookingData.cateringService,
      hireSecurity: bookingData.hireSecurity,
      tenant: bookingData.tenant,
      xstateSnapshot: bookingData.xstateSnapshot,
    }),
    [
      bookingData.setupDetails,
      bookingData.mediaServices,
      bookingData.cateringService,
      bookingData.hireSecurity,
      bookingData.tenant,
      bookingData.xstateSnapshot,
    ]
  );

  // Helper function to map XState values to BookingStatusLabel
  const getBookingStatusFromXState = useCallback(
    (stateValue: any): BookingStatusLabel => {
      if (typeof stateValue === "string") {
        switch (stateValue) {
          case "Requested":
            return BookingStatusLabel.REQUESTED;
          case "Pending":
            return BookingStatusLabel.PENDING;
          case "Pre-approval":
            return BookingStatusLabel.PENDING;
          case "Approved":
            return BookingStatusLabel.APPROVED;
          case "Declined":
            return BookingStatusLabel.DECLINED;
          case "Canceled":
            return BookingStatusLabel.CANCELED;
          case "Checked In":
            return BookingStatusLabel.CHECKED_IN;
          case "Checked Out":
            return BookingStatusLabel.CHECKED_OUT;
          default:
            return BookingStatusLabel.APPROVED; // Default for complex states
        }
      }

      // For complex/parallel states, default to APPROVED
      return BookingStatusLabel.APPROVED;
    },
    []
  );

  // Persist state to database (only when state actually changes)
  const persistStateToDatabase = useCallback(
    async (state: any) => {
      const stateString = JSON.stringify(state);

      // Only persist if state actually changed
      if (lastPersistedStateRef.current === stateString) {
        return;
      }

      try {
        await clientUpdateDataByCalendarEventId(
          TableNames.BOOKING,
          calendarEventId,
          {
            status: getBookingStatusFromXState(state.value),
            xstateSnapshot: stateString,
            lastUpdated: Timestamp.now(),
          },
          memoizedBookingData.tenant
        );

        lastPersistedStateRef.current = stateString;
        console.log(`MC XState persisted: ${JSON.stringify(state.value)}`);
      } catch (error) {
        console.error("Failed to persist XState to database:", error);
      }
    },
    [calendarEventId, getBookingStatusFromXState]
  );

  // Initialize XState actor
  useEffect(() => {
    if (!memoizedBookingData.tenant || memoizedBookingData.tenant !== "mc") {
      return; // Only for MC bookings
    }

    let newActor: Actor<typeof mcBookingMachine>;

    // Restore from existing snapshot or create new
    if (memoizedBookingData.xstateSnapshot) {
      try {
        const snapshot = JSON.parse(memoizedBookingData.xstateSnapshot);
        newActor = createActor(mcBookingMachine, {
          input: {
            booking: {
              setupDetails: memoizedBookingData.setupDetails,
              mediaServices: memoizedBookingData.mediaServices,
              cateringService: memoizedBookingData.cateringService,
              hireSecurity: memoizedBookingData.hireSecurity,
            },
          },
          snapshot: snapshot,
        });
        // Set initial persisted state to prevent unnecessary update
        lastPersistedStateRef.current = memoizedBookingData.xstateSnapshot;
      } catch (error) {
        console.error("Failed to restore XState snapshot:", error);
        // Fallback to new actor
        newActor = createActor(mcBookingMachine, {
          input: {
            booking: {
              setupDetails: memoizedBookingData.setupDetails,
              mediaServices: memoizedBookingData.mediaServices,
              cateringService: memoizedBookingData.cateringService,
              hireSecurity: memoizedBookingData.hireSecurity,
            },
          },
        });
      }
    } else {
      // Create new actor
      newActor = createActor(mcBookingMachine, {
        input: {
          booking: {
            setupDetails: memoizedBookingData.setupDetails,
            mediaServices: memoizedBookingData.mediaServices,
            cateringService: memoizedBookingData.cateringService,
            hireSecurity: memoizedBookingData.hireSecurity,
          },
        },
      });
    }

    newActor.start();
    setActor(newActor);

    // Set initial state immediately
    const initialState = newActor.getSnapshot();
    setCurrentState(initialState.value);
    setBookingStatus(getBookingStatusFromXState(initialState.value));

    console.log("MC XState actor initialized:", {
      calendarEventId,
      initialState: initialState.value,
      bookingData: {
        setupDetails: memoizedBookingData.setupDetails,
        mediaServices: memoizedBookingData.mediaServices,
        cateringService: memoizedBookingData.cateringService,
        hireSecurity: memoizedBookingData.hireSecurity,
        tenant: memoizedBookingData.tenant,
      },
    });

    // Subscribe to state changes
    const subscription = newActor.subscribe((state) => {
      setCurrentState(state.value);
      setBookingStatus(getBookingStatusFromXState(state.value));

      // Persist to database only when state changes
      persistStateToDatabase(state);
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
      newActor.stop();
    };
  }, [
    calendarEventId,
    memoizedBookingData,
    getBookingStatusFromXState,
    persistStateToDatabase,
  ]);

  // Send event to XState machine
  const sendEvent = useCallback(
    (eventType: string) => {
      if (actor) {
        console.log(`Sending ${eventType} event to MC XState machine`);
        actor.send({ type: eventType } as any);
      }
    },
    [actor]
  );

  // Check if services are requested (using same logic as XState servicesRequested guard)
  const areServicesRequested = useCallback(() => {
    if (!bookingData.tenant || bookingData.tenant !== "mc") {
      return false;
    }

    // Use the same logic as the servicesRequested guard in mcBookingMachine
    const hasSetupDetails =
      bookingData.setupDetails && bookingData.setupDetails.trim().length > 0;
    const hasMediaServices =
      bookingData.mediaServices && bookingData.mediaServices.trim().length > 0;
    const hasCateringService =
      bookingData.cateringService &&
      bookingData.cateringService.trim().length > 0;
    const hasHireSecurity =
      bookingData.hireSecurity &&
      bookingData.hireSecurity.toLowerCase() === "yes";

    const servicesNeeded =
      hasSetupDetails ||
      hasMediaServices ||
      hasCateringService ||
      hasHireSecurity;

    console.log("Frontend areServicesRequested check:", {
      hasSetupDetails,
      hasMediaServices,
      hasCateringService,
      hasHireSecurity,
      servicesNeeded,
      bookingData: {
        setupDetails: bookingData.setupDetails,
        mediaServices: bookingData.mediaServices,
        cateringService: bookingData.cateringService,
        hireSecurity: bookingData.hireSecurity,
        tenant: bookingData.tenant,
      },
    });

    return servicesNeeded;
  }, [bookingData]);

  return {
    actor,
    currentState,
    bookingStatus,
    sendEvent,
    areServicesRequested,
    isReady: !!actor,
  };
};
