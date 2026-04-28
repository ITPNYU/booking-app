import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import { authorizeRead, isAccessDenied } from "@/lib/api/authz";
import { resolveCollectionName } from "@/lib/api/firestoreServer";
import type { PaginatedRequest } from "@/lib/api/firestoreShared";

const SEARCHABLE_FIELDS = [
  "requestNumber",
  "department",
  "netId",
  "email",
  "title",
  "description",
  "firstName",
  "lastName",
  "roomId",
];

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") return new Date(value);
  if (value instanceof Date) return value;
  return null;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: PaginatedRequest;
  try {
    body = (await req.json()) as PaginatedRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.collection || !body?.filters?.sortField) {
    return NextResponse.json(
      { error: "collection and filters.sortField required" },
      { status: 400 },
    );
  }
  const decision = await authorizeRead(session, body.tenant, body.collection);
  if (isAccessDenied(decision)) {
    return NextResponse.json(
      { error: decision.reason },
      { status: decision.status },
    );
  }
  try {
    const collectionName = resolveCollectionName(body.collection, body.tenant);
    const colRef = admin.firestore().collection(collectionName);
    let q: FirebaseFirestore.Query = colRef;

    // Date range filters
    const range = Array.isArray(body.filters.dateRange)
      ? body.filters.dateRange
      : null;
    if (range && range.length === 2) {
      const start = parseDate(range[0]);
      const end = parseDate(range[1]);
      if (start)
        q = q.where("startDate", ">=", admin.firestore.Timestamp.fromDate(start));
      if (end)
        q = q.where("startDate", "<=", admin.firestore.Timestamp.fromDate(end));
    }

    // Scope to a single user's bookings when requested. The /my-bookings view
    // sets this so the LIMIT-bounded paginated result set is filtered server-
    // side instead of being filled by tenant-wide far-future bookings before
    // the client gets to filter by email.
    const userEmail = body.filters.userEmail?.trim();
    if (userEmail) {
      q = q.where("email", "==", userEmail);
    }

    const searchQuery = body.filters.searchQuery?.trim();
    if (searchQuery) {
      // Search path: fetch with date filter only, then filter in-process.
      const searchTerm = searchQuery.toLowerCase();
      const orderedQuery = q.orderBy(body.filters.sortField, "desc");
      const snapshot = await orderedQuery.get();
      const matchingDocs = snapshot.docs.filter((doc) => {
        const data = doc.data();
        if (data.firstName && data.lastName) {
          const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
          if (fullName.includes(searchTerm)) return true;
        }
        return SEARCHABLE_FIELDS.some((field) => {
          const value = data[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchTerm);
        });
      });
      return NextResponse.json({
        docs: matchingDocs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    }

    // Standard paginated path
    let orderedQuery: FirebaseFirestore.Query = q.orderBy(
      body.filters.sortField,
      "desc",
    );
    if (body.lastVisible) {
      const cursor = (body.lastVisible as Record<string, unknown>)[
        body.filters.sortField
      ];
      const reviveCursor =
        cursor &&
        typeof cursor === "object" &&
        cursor !== null &&
        "__ts" in (cursor as Record<string, unknown>)
          ? admin.firestore.Timestamp.fromMillis(
              (cursor as { __ts: number }).__ts,
            )
          : cursor;
      if (reviveCursor !== undefined && reviveCursor !== null) {
        orderedQuery = orderedQuery.startAfter(reviveCursor);
      }
    }
    if (typeof body.limit === "number") {
      orderedQuery = orderedQuery.limit(body.limit);
    }
    const snapshot = await orderedQuery.get();
    return NextResponse.json({
      docs: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    console.error("[/api/firestore/paginated] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
