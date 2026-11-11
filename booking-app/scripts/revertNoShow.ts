/**
 * Revert bookings that were marked "No Show" by mistake back to Approved.
 *
 * For each request number this script:
 *   1. Removes noShowedAt/By, canceledAt/By and closedAt/By from the booking.
 *   2. Rewrites the persisted XState snapshot to the Approved state (the MC
 *      machine auto-cancels and closes a no-show, and Closed is a final state,
 *      so the snapshot is replaced rather than transitioned).
 *   3. Marks the pre-ban log(s) written for the no-show as excused so the
 *      booking no longer counts toward an automatic ban.
 *   4. Appends an APPROVED entry to the booking history noting the revert.
 *   5. Restores the "[APPROVED]" prefix on the Google Calendar event title
 *      (skip with --skip-calendar; Google notifies attendees of the update).
 *
 * Emails already sent for the no-show cannot be recalled.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --transpile-only \
 *     --compiler-options '{"module":"commonjs","jsx":"react"}' \
 *     scripts/revertNoShow.ts --database development --tenant mc \
 *     --request 4852 --by rh3555@nyu.edu --dry-run
 *
 * Options:
 *   --database <env>   development | staging | production (default: development)
 *   --tenant <id>      Tenant whose collections to use (default: mc)
 *   --request <n>      Request number to revert; repeat for several bookings
 *   --by <email>       Who performs the revert (recorded in history and pre-ban logs)
 *   --dry-run          Print the planned changes without writing anything
 *   --skip-calendar    Do not touch the Google Calendar event
 */
require("dotenv").config({ path: ".env.local" });

// The app's server modules import "server-only", which throws outside the
// Next.js server runtime. Replace it with an empty module for this script.
{
  const Module = require("module");
  const serverOnlyPath = require.resolve("server-only");
  const stub = new Module(serverOnlyPath);
  stub.filename = serverOnlyPath;
  stub.loaded = true;
  stub.exports = {};
  require.cache[serverOnlyPath] = stub;
}

type Options = {
  database: "development" | "staging" | "production";
  tenant: string;
  requests: number[];
  by: string;
  dryRun: boolean;
  skipCalendar: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    database: "development",
    tenant: "mc",
    requests: [],
    by: "",
    dryRun: false,
    skipCalendar: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--database":
        options.database = argv[++i] as Options["database"];
        break;
      case "--tenant":
        options.tenant = argv[++i];
        break;
      case "--request":
        options.requests.push(Number(argv[++i]));
        break;
      case "--by":
        options.by = argv[++i];
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-calendar":
        options.skipCalendar = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!["development", "staging", "production"].includes(options.database)) {
    throw new Error(`--database must be development, staging or production`);
  }
  if (
    options.requests.length === 0 ||
    options.requests.some((n) => !Number.isInteger(n))
  ) {
    throw new Error("Pass at least one --request <number>");
  }
  if (!options.by) {
    throw new Error("--by <email> is required");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  // The app's firebase-admin module reads NEXT_PUBLIC_DATABASE_NAME when it is
  // first imported, so point it at the requested database before importing.
  const { DATABASES } = await import("../lib/firebase/server/databases");
  const databaseId = DATABASES[options.database];
  if (databaseId === "(default)") {
    delete process.env.NEXT_PUBLIC_DATABASE_NAME;
  } else {
    process.env.NEXT_PUBLIC_DATABASE_NAME = databaseId;
  }

  const admin = (await import("../lib/firebase/server/firebaseAdmin")).default;
  const { logServerBookingChange } =
    await import("../lib/firebase/server/adminDb");
  const { getMachineForTenant } =
    await import("../lib/stateMachines/xstatePersistence");
  const { createActor } = await import("xstate");
  const { getTenantCollectionName, TableNames } =
    await import("../components/src/policy");
  const { BookingStatusLabel } = await import("../components/src/types");

  const db = admin.firestore();
  const bookingsCol = getTenantCollectionName(
    TableNames.BOOKING,
    options.tenant,
  );
  const preBanCol = getTenantCollectionName(
    TableNames.PRE_BAN_LOGS,
    options.tenant,
  );

  console.log(
    `${options.dryRun ? "[DRY RUN] " : ""}database=${databaseId} tenant=${options.tenant} ` +
      `requests=${options.requests.join(",")} by=${options.by}`,
  );

  let failures = 0;
  for (const requestNumber of options.requests) {
    console.log(`\n=== #${requestNumber} ===`);
    try {
      await revertOne(requestNumber);
    } catch (error) {
      failures++;
      console.error(`  FAILED: ${(error as Error).message}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} booking(s) failed.`);
    process.exit(1);
  }
  console.log(`\nDone${options.dryRun ? " (dry run, nothing written)" : ""}.`);

  async function revertOne(requestNumber: number) {
    const snap = await db
      .collection(bookingsCol)
      .where("requestNumber", "==", requestNumber)
      .get();
    if (snap.size !== 1) {
      throw new Error(`expected exactly one booking, found ${snap.size}`);
    }
    const doc = snap.docs[0];
    const data = doc.data();
    const calendarEventId: string | undefined = data.calendarEventId;
    if (!data.noShowedAt) {
      throw new Error("booking is not marked as no show; nothing to revert");
    }
    if (!data.finalApprovedAt) {
      throw new Error(
        "booking was never approved; refusing to set it to Approved",
      );
    }
    if (!calendarEventId) {
      throw new Error("booking has no calendarEventId");
    }

    const fmt = (v: any) =>
      v?.toDate ? v.toDate().toISOString() : String(v ?? "-");
    console.log(`  doc=${doc.id} email=${data.email} room=${data.roomId}`);
    console.log(
      `  start=${fmt(data.startDate)} approved=${fmt(data.finalApprovedAt)}`,
    );
    console.log(`  noShow=${fmt(data.noShowedAt)} by ${data.noShowedBy}`);
    console.log(
      `  canceled=${fmt(data.canceledAt)} closed=${fmt(data.closedAt)}`,
    );

    // 1 + 2. Booking fields and XState snapshot.
    const previousSnapshot = data.xstateData?.snapshot;
    if (!previousSnapshot) {
      throw new Error("booking has no xstateData.snapshot");
    }
    const { automationReason: _dropped, ...context } =
      previousSnapshot.context ?? {};
    const approvedSnapshot = {
      ...previousSnapshot,
      status: "active",
      value: "Approved",
      historyValue: {},
      children: {},
      context: { ...context, pendingSideEffects: [] },
    };
    // Make sure the machine accepts the snapshot before writing it.
    const machine = getMachineForTenant(options.tenant);
    const restored = createActor(machine, {
      snapshot: approvedSnapshot as any,
    }).getSnapshot();
    if (restored.value !== "Approved" || restored.status !== "active") {
      throw new Error(
        `snapshot did not restore to Approved (value=${JSON.stringify(restored.value)}, status=${restored.status})`,
      );
    }
    const bookingUpdate: Record<string, unknown> = {
      noShowedAt: admin.firestore.FieldValue.delete(),
      noShowedBy: admin.firestore.FieldValue.delete(),
      canceledAt: admin.firestore.FieldValue.delete(),
      canceledBy: admin.firestore.FieldValue.delete(),
      closedAt: admin.firestore.FieldValue.delete(),
      closedBy: admin.firestore.FieldValue.delete(),
      xstateData: {
        ...data.xstateData,
        snapshot: approvedSnapshot,
        lastTransition: new Date().toISOString(),
      },
    };
    console.log(
      `  booking: delete noShowedAt/By canceledAt/By closedAt/By; xstate ${previousSnapshot.value} -> Approved`,
    );

    // 3. Pre-ban logs for this booking.
    const preBanSnap = await db
      .collection(preBanCol)
      .where("bookingId", "==", calendarEventId)
      .get();
    const preBanToExcuse = preBanSnap.docs.filter(
      (d) => d.data().excused !== true,
    );
    console.log(
      `  pre-ban logs: ${preBanSnap.size} found, ${preBanToExcuse.length} to mark excused` +
        (preBanToExcuse.length
          ? ` (${preBanToExcuse.map((d) => d.id).join(", ")})`
          : ""),
    );

    // 4. History entry.
    const note = "No Show reverted: the booking was marked as no show in error";
    console.log(`  history: append APPROVED by ${options.by} — "${note}"`);

    // 5. Calendar.
    console.log(
      options.skipCalendar
        ? "  calendar: skipped (--skip-calendar)"
        : `  calendar: set [APPROVED] prefix on event ${calendarEventId}`,
    );

    if (options.dryRun) {
      return;
    }

    const batch = db.batch();
    batch.update(doc.ref, bookingUpdate);
    for (const d of preBanToExcuse) {
      batch.update(d.ref, {
        excused: true,
        excusedAt: admin.firestore.Timestamp.now(),
        excusedBy: options.by,
        excusedReason: note,
      });
    }
    await batch.commit();
    console.log("  booking and pre-ban logs updated");

    await logServerBookingChange({
      bookingId: doc.id,
      calendarEventId,
      status: BookingStatusLabel.APPROVED,
      changedBy: options.by,
      requestNumber,
      note,
      tenant: options.tenant,
    });
    console.log("  history entry written");

    if (!options.skipCalendar) {
      // The database is already consistent at this point, so a calendar
      // problem (e.g. the event was deleted) is reported but does not fail the run.
      try {
        const { serverBookingContents } =
          await import("../components/src/server/admin");
        const { updateCalendarEvent } =
          await import("../components/src/server/calendars");
        const contents = await serverBookingContents(
          calendarEventId,
          options.tenant,
        );
        await updateCalendarEvent(
          calendarEventId,
          { statusPrefix: BookingStatusLabel.APPROVED },
          contents,
          options.tenant,
        );
        console.log("  calendar event title updated");
      } catch (error) {
        console.warn(
          `  WARNING: calendar event ${calendarEventId} was not updated: ${(error as Error).message}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
