import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import { authorizeWrite, isAccessDenied } from "@/lib/api/authz";
import { resolveCollectionName, reviveValue } from "@/lib/api/firestoreServer";
import type { MutateRequest } from "@/lib/api/firestoreShared";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: MutateRequest;
  try {
    body = (await req.json()) as MutateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.op || !body?.collection) {
    return NextResponse.json(
      { error: "op and collection required" },
      { status: 400 },
    );
  }
  const decision = await authorizeWrite(session, body.tenant, body.collection);
  if (isAccessDenied(decision)) {
    return NextResponse.json(
      { error: decision.reason },
      { status: decision.status },
    );
  }
  const collectionName = resolveCollectionName(body.collection, body.tenant);
  const colRef = admin.firestore().collection(collectionName);
  try {
    if (body.op === "create") {
      const data = reviveValue(body.data) as FirebaseFirestore.DocumentData;
      const docRef = await colRef.add(data);
      return NextResponse.json({ id: docRef.id });
    }
    if (body.op === "update") {
      if (!body.docId) {
        return NextResponse.json(
          { error: "docId required" },
          { status: 400 },
        );
      }
      const data = reviveValue(body.data) as FirebaseFirestore.DocumentData;
      await colRef.doc(body.docId).update(data);
      return NextResponse.json({ ok: true });
    }
    if (body.op === "delete") {
      if (!body.docId) {
        return NextResponse.json(
          { error: "docId required" },
          { status: 400 },
        );
      }
      await colRef.doc(body.docId).delete();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (error) {
    console.error("[/api/firestore/mutate] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
