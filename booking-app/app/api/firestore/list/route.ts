import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api/requireSession";
import { listDocs } from "@/lib/api/firestoreServer";
import type { ListRequest } from "@/lib/api/firestoreShared";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: ListRequest;
  try {
    body = (await req.json()) as ListRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.collection) {
    return NextResponse.json(
      { error: "collection required" },
      { status: 400 },
    );
  }
  try {
    const docs = await listDocs(body.collection, body.tenant, {
      where: body.where,
      orderBy: body.orderBy,
      limit: body.limit,
    });
    return NextResponse.json({ docs });
  } catch (error) {
    console.error("[/api/firestore/list] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
