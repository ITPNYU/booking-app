import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { FormContextLevel } from "@/components/src/types";
import { isValidNetIdFormat } from "@/components/src/utils/validationHelpers";
import { useParams, usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { DatabaseContext } from "../../components/Provider";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";

export default function useCheckRequestLimits(formContext: FormContextLevel) {
  const params = useParams();
  const pathname = usePathname();
  const tenant = (params?.tenant as string) || DEFAULT_TENANT;
  const { userEmail } = useContext(DatabaseContext);
  const { bookingCalendarInfo, selectedRooms, role, formData } =
    useContext(BookingContext);
  const schema = useTenantSchema();

  const [requestLimitError, setRequestLimitError] = useState<string | null>(
    null,
  );
  const [requestLimitChecking, setRequestLimitChecking] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const isSelectRoomPage = pathname.endsWith("/selectRoom");
  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isVIP = formContext === FormContextLevel.VIP;

  useEffect(() => {
    abortRef.current?.abort();
    setRequestLimitError(null);

    if (
      !isSelectRoomPage ||
      !schema.tenant ||
      !role ||
      selectedRooms.length === 0 ||
      bookingCalendarInfo == null
    ) {
      setRequestLimitChecking(false);
      return;
    }

    let email: string | undefined;
    if (isWalkIn || isVIP) {
      const netIdToUse = formData?.walkInNetId || formData?.netId;
      if (netIdToUse && isValidNetIdFormat(netIdToUse)) {
        email = `${netIdToUse}@nyu.edu`;
      }
    } else {
      email = userEmail || formData?.missingEmail;
    }

    const roomIds = selectedRooms
      .map((r) => Number(r.roomId))
      .filter((n) => Number.isFinite(n));

    if (!email?.trim() || roomIds.length === 0) {
      setRequestLimitChecking(false);
      return;
    }

    const bookingRoleField = String(role);

    const controller = new AbortController();
    abortRef.current = controller;
    setRequestLimitChecking(true);

    fetch("/api/bookings/request-limits", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant,
      },
      body: JSON.stringify({
        email: email.trim(),
        bookingRoleField,
        formContext,
        roomIds,
      }),
    })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          setRequestLimitError(
            typeof body?.error === "string"
              ? body.error
              : "Request limit reached for one of the selected spaces.",
          );
          return;
        }
        if (!res.ok) {
          // Fail open on unexpected errors so booking is not blocked by UX check alone
          setRequestLimitError(null);
          return;
        }
        setRequestLimitError(null);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        console.error("request limits check failed:", e);
        setRequestLimitError(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRequestLimitChecking(false);
      });

    return () => controller.abort();
  }, [
    isSelectRoomPage,
    schema.tenant,
    tenant,
    userEmail,
    role,
    selectedRooms,
    bookingCalendarInfo,
    formContext,
    formData?.walkInNetId,
    formData?.netId,
    formData?.missingEmail,
    isWalkIn,
    isVIP,
  ]);

  return { requestLimitError, requestLimitChecking };
}
