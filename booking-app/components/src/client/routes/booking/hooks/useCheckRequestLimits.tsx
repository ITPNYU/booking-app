import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { FormContextLevel } from "@/components/src/types";
import { isValidNetIdFormat } from "@/components/src/utils/validationHelpers";
import { useParams, usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { DatabaseContext } from "../../components/Provider";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";

/**
 * True when the app is running inside Playwright E2E tests.
 * Evaluated once at module load; never changes at runtime.
 */
const isE2ETesting = process.env.NEXT_PUBLIC_E2E_TESTING === "true";

/**
 * Checks whether the current user has hit per-resource request limits by
 * calling /api/bookings/request-limits on the Select Room page.
 *
 * E2E bypass: when NEXT_PUBLIC_E2E_TESTING is "true" the hook skips the
 * network request so it does not interfere with Playwright flows. All React
 * hooks are still called unconditionally to satisfy the Rules of Hooks.
 * Server-side enforcement still applies in /api/bookings/request-limits and
 * the booking submission routes.
 */
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
    // Bypass in E2E to avoid async network churn that disables the Next button
    // and causes Playwright timeouts. Server-side enforcement in API routes is
    // unaffected by this bypass.
    if (isE2ETesting) return;
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
