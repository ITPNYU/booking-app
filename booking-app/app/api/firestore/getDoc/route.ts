import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCollectionName } from "@/lib/api/firestoreServer";
import type { GetDocRequest } from "@/lib/api/firestoreShared";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: GetDocRequest;
  try {
    body = (await req.json()) as GetDocRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.collection || !body?.docId) {
    return NextResponse.json(
      { error: "collection and docId required" },
      { status: 400 },
    );
  }
  try {
    const collectionName = resolveCollectionName(body.collection, body.tenant);
    const snap = await admin
      .firestore()
      .collection(collectionName)
      .doc(body.docId)
      .get();
    if (!snap.exists) {
      return NextResponse.json({ doc: null });
    }
    return NextResponse.json({ doc: { id: snap.id, ...snap.data() } });
  } catch (error) {
    console.error("[/api/firestore/getDoc] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
