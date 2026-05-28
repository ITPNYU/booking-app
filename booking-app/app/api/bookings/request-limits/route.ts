import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { TableNames } from "@/components/src/policy";
import { FormContextLevel } from "@/components/src/types";
import {
  enforceRequestLimits,
  getRequestLimitRoleKey,
} from "@/lib/bookingRequestLimits";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { extractTenantFromRequest } from "../shared";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim();
    const bookingRoleField = String(body?.bookingRoleField ?? "").trim();
    const formContext = body?.formContext as FormContextLevel | undefined;
    const roomIdsRaw = body?.roomIds;

    const roomIds: number[] = Array.isArray(roomIdsRaw)
      ? roomIdsRaw
          .map((x: unknown) => Number(x))
          .filter((n: number) => Number.isFinite(n))
      : [];

    const tenant = extractTenantFromRequest(request);

    if (!tenant || !email || !bookingRoleField || roomIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing tenant, email, role, or roomIds" },
        { status: 400 },
      );
    }

    const context =
      formContext === FormContextLevel.VIP ||
      formContext === FormContextLevel.WALK_IN ||
      formContext === FormContextLevel.FULL_FORM ||
      formContext === FormContextLevel.EDIT ||
      formContext === FormContextLevel.MODIFICATION
        ? formContext
        : FormContextLevel.FULL_FORM;

    const limitRoleKey = getRequestLimitRoleKey(context, bookingRoleField);

    const schema = await serverGetDocumentById<SchemaContextType>(
      TableNames.TENANT_SCHEMA,
      tenant,
      tenant,
    );

    const enforcement = await enforceRequestLimits({
      tenant,
      email,
      bookingRoleField,
      limitRoleKey,
      selectedRoomIds: roomIds,
      schema,
    });

    if (enforcement.ok === false) {
      return NextResponse.json(
        { ok: false, error: enforcement.message },
        { status: 429 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("request-limits API error:", e);
    return NextResponse.json(
      { ok: false, error: "Unable to check request limits" },
      { status: 500 },
    );
  }
}
