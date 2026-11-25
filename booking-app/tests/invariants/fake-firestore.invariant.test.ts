import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { FakeFirestore } from "./harness/fakeFirestore";

/** The fake has to behave like Firestore where the booking code relies on it. */
describe("fakeFirestore", () => {
  it("update() writes dotted paths into nested fields and keeps siblings", async () => {
    const db = new FakeFirestore();
    db.seed("bookings", "a", {
      xstateData: { snapshot: { value: "Requested", status: "active" } },
    });

    await db
      .collection("bookings")
      .doc("a")
      .update({ "xstateData.snapshot.value": "Closed" });

    expect(db.peek("bookings", "a")).toEqual({
      xstateData: { snapshot: { value: "Closed", status: "active" } },
    });
  });

  it("update() replaces a top-level map whole", async () => {
    const db = new FakeFirestore();
    db.seed("bookings", "a", {
      xstateData: { machineId: "m", snapshot: { value: "Requested" } },
    });

    await db
      .collection("bookings")
      .doc("a")
      .update({ xstateData: { machineId: "m" } });

    expect(db.peek("bookings", "a")).toEqual({
      xstateData: { machineId: "m" },
    });
  });

  it("update() removes a field given FieldValue.delete()", async () => {
    const db = new FakeFirestore();
    db.seed("bookings", "a", { declinedAt: Timestamp.now(), title: "t" });

    await db
      .collection("bookings")
      .doc("a")
      .update({ declinedAt: FieldValue.delete() });

    expect(db.peek("bookings", "a")).toEqual({ title: "t" });
  });

  it("update() rejects a document that does not exist", async () => {
    const db = new FakeFirestore();
    await expect(
      db.collection("bookings").doc("missing").update({ a: 1 }),
    ).rejects.toThrow();
  });

  it("where() filters, orders and limits, comparing Timestamps by time", async () => {
    const db = new FakeFirestore();
    const at = (ms: number) => Timestamp.fromMillis(ms);
    db.seed("bookings", "old", { calendarEventId: "x", startDate: at(1000) });
    db.seed("bookings", "new", { calendarEventId: "x", startDate: at(3000) });
    db.seed("bookings", "other", { calendarEventId: "y", startDate: at(2000) });

    const result = await db
      .collection("bookings")
      .where("calendarEventId", "==", "x")
      .where("startDate", ">", at(500))
      .orderBy("startDate", "desc")
      .limit(1)
      .get();

    expect(result.docs.map((doc) => doc.id)).toEqual(["new"]);
  });

  it("does not let a caller mutate stored data through what it read", async () => {
    const db = new FakeFirestore();
    db.seed("bookings", "a", { nested: { value: 1 } });

    const snapshot = await db.collection("bookings").doc("a").get();
    (snapshot.data() as { nested: { value: number } }).nested.value = 2;

    expect(db.peek("bookings", "a")).toEqual({ nested: { value: 1 } });
  });
});
