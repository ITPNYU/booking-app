import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { Timestamp } from "firebase/firestore";

export async function callXStateTransitionAPI(
  calendarEventId: string,
  eventType: string,
  email: string,
  tenant?: string,
  reason?: string,
  netId?: string,
): Promise<{ success: boolean; newState?: string; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/xstate-transition`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant || DEFAULT_TENANT,
        },
        body: JSON.stringify({
          calendarEventId,
          eventType,
          email,
          netId,
          reason,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error,
      };
    }

    const result = await response.json();
    return {
      success: true,
      newState: result.newState,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

const logClientBookingChange = async ({
  bookingId,
  calendarEventId,
  status,
  changedBy,
  requestNumber,
  note,
  tenant,
}: {
  bookingId: string;
  calendarEventId: string;
  status: BookingStatusLabel;
  changedBy: string;
  requestNumber: number;
  note?: string;
  tenant?: string;
}) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
      },
      body: JSON.stringify({
        bookingId,
        calendarEventId,
        status,
        changedBy,
        requestNumber,
        note: note ?? null,
      }),
    },
  );

  if (!response.ok) {
    console.error("Failed to log booking change:", await response.text());
  }
};

const postCloseProcessing = async (
  calendarEventId: string,
  email: string,
  tenant?: string,
) => {
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/close-processing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
    },
    body: JSON.stringify({
      calendarEventId,
      email,
      tenant,
    }),
  });
};

export const cancel = async (
  id: string,
  email: string,
  netId: string,
  tenant?: string,
) => {
  const xstateResult = await callXStateTransitionAPI(
    id,
    "cancel",
    email,
    tenant,
    undefined,
    netId,
  );

  if (!xstateResult.success) {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/cancel-processing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
      },
      body: JSON.stringify({
        calendarEventId: id,
        email,
        netId,
        tenant,
      }),
    });
    return;
  }

  if (xstateResult.newState === "Closed") {
    await postCloseProcessing(id, email, tenant);
  }
};

export const decline = async (
  id: string,
  email: string,
  reason?: string,
  tenant?: string,
) => {
  if (shouldUseXState(tenant)) {
    const xstateResult = await callXStateTransitionAPI(
      id,
      "decline",
      email,
      tenant,
      reason,
    );

    if (xstateResult.success) {
      const doc = await clientGetDataByCalendarEventId<{
        id: string;
        requestNumber: number;
      }>(TableNames.BOOKING, id, tenant);

      if (doc) {
        await logClientBookingChange({
          bookingId: doc.id,
          calendarEventId: id,
          status: BookingStatusLabel.DECLINED,
          changedBy: email,
          requestNumber: doc.requestNumber,
          note: reason,
          tenant,
        });
      }
      return;
    }
  }

  clientUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      declinedAt: Timestamp.now(),
      declinedBy: email,
      declineReason: reason || null,
    },
    tenant,
  );

  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);

  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.DECLINED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      note: reason,
      tenant,
    });
  }
};

export const checkin = async (id: string, email: string, tenant?: string) => {
  const xstateResult = await callXStateTransitionAPI(
    id,
    "checkIn",
    email,
    tenant,
  );

  if (!xstateResult.success) {
    throw new Error(`XState checkin failed: ${xstateResult.error}`);
  }

  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/checkin-processing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarEventId: id,
      email,
      tenant,
    }),
  });
};

export const checkOut = async (id: string, email: string, tenant?: string) => {
  const xstateResult = await callXStateTransitionAPI(
    id,
    "checkOut",
    email,
    tenant,
  );

  if (!xstateResult.success) {
    throw new Error(`XState checkout failed: ${xstateResult.error}`);
  }

  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/checkout-processing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarEventId: id,
      email,
      tenant,
    }),
  });

  if (xstateResult.newState === "Closed") {
    await postCloseProcessing(id, email, tenant);
  }
};

export const noShow = async (
  id: string,
  email: string,
  netId: string,
  tenant?: string,
) => {
  if (shouldUseXState(tenant)) {
    const xstateResult = await callXStateTransitionAPI(
      id,
      "noShow",
      email,
      tenant,
      undefined,
      netId,
    );

    if (xstateResult.success) {
      if (xstateResult.newState === "Closed") {
        await postCloseProcessing(id, email, tenant);
      }
      return;
    }
  }

  clientUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      noShowedAt: Timestamp.now(),
      noShowedBy: email,
    },
    tenant,
  );
};

export const clientApproveBooking = async (
  id: string,
  email: string,
  tenant?: string,
) => {
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
    },
    body: JSON.stringify({ id, email }),
  });
};

export const clientEquipmentApprove = async (_id: string, _email: string) => {
  // Equipment approval is handled via dedicated API routes when enabled.
};

export const clientSendToEquipment = async (id: string, email: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/equipment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      email,
      action: "SEND_TO_EQUIPMENT",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to send booking to equipment");
  }
};
