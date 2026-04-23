import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCollectionName, reviveValue } from "@/lib/api/firestoreServer";
import { TableNames } from "@/components/src/policy";
import {
  USER_RIGHT_FLAG_FIELDS,
  type UserRightFlagField,
} from "@/lib/firebase/userRightsConstants";
import type { UserRightsRequest } from "@/lib/api/firestoreShared";

const USER_COLLECTIONS: TableNames[] = [TableNames.ADMINS, TableNames.PAS];

function buildDefaultUserRightFlags(
  overrides: Partial<Record<UserRightFlagField, boolean>> = {},
): Record<UserRightFlagField, boolean> {
  return USER_RIGHT_FLAG_FIELDS.reduce(
    (acc, currentFlag) => {
      acc[currentFlag] = overrides[currentFlag] ?? false;
      return acc;
    },
    {} as Record<UserRightFlagField, boolean>,
  );
}

function flagForLegacyCollection(
  collection: string,
): UserRightFlagField | null {
  if (collection === TableNames.ADMINS) return "isAdmin";
  if (collection === TableNames.PAS) return "isWorker";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: UserRightsRequest;
  try {
    body = (await req.json()) as UserRightsRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const usersRightsCollection = resolveCollectionName(
      TableNames.USERS_RIGHTS,
      body.tenant,
    );
    const usersRightsRef = admin
      .firestore()
      .collection(usersRightsCollection);

    if (body.action === "save") {
      const isLegacy = USER_COLLECTIONS.includes(body.collection as TableNames);
      if (isLegacy) {
        const email = (body.data as Record<string, unknown>).email as
          | string
          | undefined;
        if (!email) {
          return NextResponse.json(
            { error: "email required" },
            { status: 400 },
          );
        }
        const flag = flagForLegacyCollection(body.collection);
        if (!flag) {
          return NextResponse.json(
            { error: "unsupported user collection" },
            { status: 400 },
          );
        }
        const existing = await usersRightsRef
          .where("email", "==", email)
          .get();
        if (!existing.empty) {
          await usersRightsRef
            .doc(existing.docs[0].id)
            .update({ [flag]: true });
          return NextResponse.json({ id: existing.docs[0].id, updated: true });
        }
        const data = reviveValue(body.data) as Record<string, unknown>;
        const docRef = await usersRightsRef.add({
          email,
          createdAt: data.createdAt ?? admin.firestore.Timestamp.now(),
          ...buildDefaultUserRightFlags({ [flag]: true }),
          ...data,
        });
        return NextResponse.json({ id: docRef.id, created: true });
      }
      const colRef = admin
        .firestore()
        .collection(resolveCollectionName(body.collection, body.tenant));
      const data = reviveValue(body.data) as FirebaseFirestore.DocumentData;
      const docRef = await colRef.add(data);
      return NextResponse.json({ id: docRef.id, created: true });
    }

    if (body.action === "delete") {
      const isLegacy = USER_COLLECTIONS.includes(body.collection as TableNames);
      if (isLegacy) {
        const userDoc = await usersRightsRef.doc(body.docId).get();
        if (!userDoc.exists) {
          return NextResponse.json(
            { error: "user not found" },
            { status: 404 },
          );
        }
        const userData = userDoc.data() as Record<string, unknown>;
        const flag = flagForLegacyCollection(body.collection);
        const updatedFlags = {
          isAdmin:
            body.collection === TableNames.ADMINS ? false : userData.isAdmin,
          isWorker:
            body.collection === TableNames.PAS ? false : userData.isWorker,
        };
        if (!updatedFlags.isAdmin && !updatedFlags.isWorker) {
          await usersRightsRef.doc(body.docId).delete();
          return NextResponse.json({ deleted: true });
        }
        if (flag) {
          await usersRightsRef.doc(body.docId).update({ [flag]: false });
        }
        return NextResponse.json({ updated: true });
      }
      const colRef = admin
        .firestore()
        .collection(resolveCollectionName(body.collection, body.tenant));
      await colRef.doc(body.docId).delete();
      return NextResponse.json({ deleted: true });
    }

    if (body.action === "upsertFlag") {
      const trimmedEmail = body.email.trim();
      if (!trimmedEmail) {
        return NextResponse.json(
          { error: "email required" },
          { status: 400 },
        );
      }
      const flag = body.flag as UserRightFlagField;
      const existing = await usersRightsRef
        .where("email", "==", trimmedEmail)
        .get();
      if (!existing.empty) {
        await usersRightsRef
          .doc(existing.docs[0].id)
          .update({ [flag]: true });
        return NextResponse.json({ id: existing.docs[0].id, updated: true });
      }
      const docRef = await usersRightsRef.add({
        email: trimmedEmail,
        createdAt: admin.firestore.Timestamp.now(),
        ...buildDefaultUserRightFlags(),
        [flag]: true,
      });
      return NextResponse.json({ id: docRef.id, created: true });
    }

    if (body.action === "clearFlag") {
      const targetRef = usersRightsRef.doc(body.docId);
      const userDoc = await targetRef.get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "user not found" }, { status: 404 });
      }
      const userData = userDoc.data() as Partial<
        Record<UserRightFlagField, boolean>
      >;
      const flag = body.flag as UserRightFlagField;
      const updatedFlags = USER_RIGHT_FLAG_FIELDS.reduce(
        (acc, currentFlag) => {
          if (currentFlag === flag) {
            acc[currentFlag] = false;
          } else {
            acc[currentFlag] = userData[currentFlag] === true;
          }
          return acc;
        },
        {} as Record<UserRightFlagField, boolean>,
      );
      const shouldDelete = USER_RIGHT_FLAG_FIELDS.every(
        (f) => !updatedFlags[f],
      );
      if (shouldDelete) {
        await targetRef.delete();
        return NextResponse.json({ deleted: true });
      }
      await targetRef.update({ [flag]: false });
      return NextResponse.json({ updated: true });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[/api/firestore/userRights] error:", error);
    return NextResponse.json(
      { error: (error as Error).message ?? "Internal error" },
      { status: 500 },
    );
  }
}
