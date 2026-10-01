/**
 * Backfill calendar guests for multi-room bookings approved while the invite
 * lookup was broken (issue #1626).
 *
 * Between the 2026-07-08 and 2026-09-16 production deploys, approving a
 * booking whose roomId is a comma-joined list ("220, 221, 222") resolved zero
 * room calendars, so the requester and secondary contact were never added to
 * the Google Calendar event. The code is fixed (#1563); this script re-invites
 * the guests on bookings approved in that window.
 *
 * It is idempotent: a guest already on the event is skipped, so it is safe to
 * re-run. Nothing is written to Firestore. Without --apply it only reports
 * what it would do.
 *
 * Usage:
 *   npm run backfill:multi-room-invites -- --database production
 *   npm run backfill:multi-room-invites -- --database production --apply
 *
 * Options:
 *   --database <env>        development | staging | production (default: development)
 *   --tenant <tenant>       Tenant whose bookings to scan (default: mc)
 *   --apply                 Patch the calendar events (default: dry run)
 *   --send-updates <mode>   none | all. "all" emails every guest on the event,
 *                           including the room calendars (default: none)
 *   --approved-from <iso>   Start of the approval window (default: 2026-07-08T00:09:34Z)
 *   --approved-to <iso>     End of the approval window (default: 2026-09-16T00:26:00Z)
 *   --include-past          Also process bookings that have already started
 *   --only <numbers>        Comma-separated request numbers to process
 *   --help
 *
 * Requires FIREBASE_* and GOOGLE_* credentials in .env.local. The Google
 * account must be able to edit the target environment's room calendars.
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import { getCalendarClient } from "../lib/googleClient";
import {
  DEFAULT_APPROVED_FROM,
  DEFAULT_APPROVED_TO,
  guestEmailsForBooking,
  isAffectedBooking,
  missingGuests,
  orderOrganizerFirst,
  resolveRoomCalendarIds,
  splitRoomIds,
  type CalendarResource,
} from "./lib/multiRoomInviteBackfill";

const TENANT_SCHEMA_COLLECTION = "tenantSchema";
// Stay well under the Calendar API per-user rate limit.
const WRITE_DELAY_MS = 300;

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

type SendUpdates = "none" | "all";

interface BackfillOptions {
  apply: boolean;
  database: string;
  tenant: string;
  sendUpdates: SendUpdates;
  approvedFrom: Date;
  approvedTo: Date;
  includePast: boolean;
  only?: Set<number>;
}

function parseDate(value: string | undefined, flag: string): Date {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.getTime())) {
    console.error(`❌ ${flag} needs an ISO date, got "${value}"`);
    process.exit(1);
  }
  return date;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    apply: false,
    database: "development",
    tenant: "mc",
    sendUpdates: "none",
    approvedFrom: new Date(DEFAULT_APPROVED_FROM),
    approvedTo: new Date(DEFAULT_APPROVED_TO),
    includePast: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--apply":
        options.apply = true;
        break;
      case "--database":
        options.database = args[++i] || "development";
        break;
      case "--tenant":
        options.tenant = args[++i] || "mc";
        break;
      case "--send-updates": {
        const mode = args[++i];
        if (mode !== "none" && mode !== "all") {
          console.error(`❌ --send-updates must be none or all, got "${mode}"`);
          process.exit(1);
        }
        options.sendUpdates = mode;
        break;
      }
      case "--approved-from":
        options.approvedFrom = parseDate(args[++i], "--approved-from");
        break;
      case "--approved-to":
        options.approvedTo = parseDate(args[++i], "--approved-to");
        break;
      case "--include-past":
        options.includePast = true;
        break;
      case "--only":
        options.only = new Set(
          (args[++i] || "")
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value) && value > 0),
        );
        break;
      case "--help":
        console.log(`
Usage: npx ts-node scripts/backfillMultiRoomCalendarInvites.ts [options]

Options:
  --database <env>        development | staging | production (default: development)
  --tenant <tenant>       Tenant whose bookings to scan (default: mc)
  --apply                 Patch the calendar events (default: dry run)
  --send-updates <mode>   none | all (default: none)
  --approved-from <iso>   Start of the approval window (default: ${DEFAULT_APPROVED_FROM})
  --approved-to <iso>     End of the approval window (default: ${DEFAULT_APPROVED_TO})
  --include-past          Also process bookings that have already started
  --only <numbers>        Comma-separated request numbers to process
  --help                  Show this help message
        `);
        process.exit(0);
      default:
        console.error(`❌ Unknown option "${args[i]}". Use --help.`);
        process.exit(1);
    }
  }

  if (!DATABASES[options.database]) {
    console.error(
      `❌ Unknown database "${options.database}". Use development, staging, or production.`,
    );
    process.exit(1);
  }
  return options;
}

function initializeDb(databaseName: string) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  const db = admin.firestore();
  if (databaseName !== "default") {
    db.settings({ databaseId: databaseName });
  }
  return db;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const toDate = (value: unknown): Date | null => {
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

type Outcome = "invited" | "already-invited" | "skipped" | "failed";

async function main() {
  const options = parseArgs();
  const databaseName = DATABASES[options.database];
  const isProduction = options.database === "production";
  const prefix = options.apply ? "" : "🔍 [DRY RUN] ";
  console.log(
    `${prefix}Backfilling multi-room calendar invites for ${options.tenant} in ${options.database} (${databaseName})`,
  );
  console.log(
    `  Approved between ${options.approvedFrom.toISOString()} and ${options.approvedTo.toISOString()}, sendUpdates=${options.sendUpdates}`,
  );

  const db = initializeDb(databaseName);
  const schemaSnapshot = await db
    .collection(TENANT_SCHEMA_COLLECTION)
    .doc(options.tenant)
    .get();
  const resources = (schemaSnapshot.data()?.resources ??
    []) as CalendarResource[];
  if (resources.length === 0) {
    console.error(
      `❌ ${TENANT_SCHEMA_COLLECTION}/${options.tenant} has no resources[] in ${databaseName}`,
    );
    process.exit(1);
  }

  const bookingsRef = db.collection(`${options.tenant}-bookings`);
  const bookingsSnapshot = options.includePast
    ? await bookingsRef
        .where(
          "finalApprovedAt",
          ">=",
          admin.firestore.Timestamp.fromDate(options.approvedFrom),
        )
        .where(
          "finalApprovedAt",
          "<",
          admin.firestore.Timestamp.fromDate(options.approvedTo),
        )
        .get()
    : await bookingsRef
        .where("startDate", ">=", admin.firestore.Timestamp.now())
        .get();

  const window = {
    approvedFrom: options.approvedFrom,
    approvedTo: options.approvedTo,
  };
  const affected = bookingsSnapshot.docs
    .map((doc) => doc.data())
    .filter((booking) =>
      isAffectedBooking(
        { ...booking, finalApprovedAt: toDate(booking.finalApprovedAt) },
        window,
      ),
    )
    .filter(
      (booking) =>
        !options.only || options.only.has(Number(booking.requestNumber)),
    )
    .sort((a, b) => Number(a.requestNumber) - Number(b.requestNumber));

  console.log(
    `  Scanned ${bookingsSnapshot.size} booking(s), ${affected.length} multi-room booking(s) approved in the window.\n`,
  );

  const calendar = await getCalendarClient();
  const counts: Record<Outcome, number> = {
    invited: 0,
    "already-invited": 0,
    skipped: 0,
    failed: 0,
  };

  for (const booking of affected) {
    const label = `#${booking.requestNumber} (${booking.roomId})`;
    const eventId = String(booking.calendarEventId ?? "");
    const guests = guestEmailsForBooking(booking);
    const { calendarIds, unresolvedRoomIds } = resolveRoomCalendarIds(
      resources,
      splitRoomIds(booking.roomId),
      isProduction,
    );
    if (unresolvedRoomIds.length > 0) {
      console.log(
        `  ⚠️  ${label}: no calendar for room(s) ${unresolvedRoomIds.join(", ")}`,
      );
    }
    if (!eventId || guests.length === 0 || calendarIds.length === 0) {
      console.log(
        `  ⏭  ${label}: skipped (missing calendarEventId, guest email, or room calendar)`,
      );
      counts.skipped += 1;
      continue;
    }

    let outcome: Outcome = "already-invited";
    let found = false;
    let organizerEmail: string | null | undefined;
    for (const calendarId of calendarIds) {
      try {
        const event = await calendar.events.get({ calendarId, eventId });
        organizerEmail = event.data.organizer?.email;
        break;
      } catch (error: any) {
        if (error?.code !== 404 && error?.code !== 410) throw error;
      }
    }

    for (const calendarId of orderOrganizerFirst(calendarIds, organizerEmail)) {
      try {
        const event = await calendar.events.get({ calendarId, eventId });
        found = true;
        const attendees = event.data.attendees ?? [];
        const toInvite = missingGuests(attendees, guests);
        if (toInvite.length === 0) continue;

        if (options.apply) {
          await calendar.events.patch({
            calendarId,
            eventId,
            sendUpdates: options.sendUpdates,
            requestBody: {
              attendees: [
                ...attendees,
                ...toInvite.map((email) => ({ email })),
              ],
            },
          });
          await sleep(WRITE_DELAY_MS);
        }
        outcome = "invited";
        console.log(
          `  ${options.apply ? "✉️ " : "🔍"} ${label}: ${options.apply ? "invited" : "would invite"} ${toInvite.join(", ")} on ${calendarId}`,
        );
        // A dry run never changes the event, so the other rooms would only
        // repeat the same line.
        if (!options.apply) break;
      } catch (error: any) {
        // Annex / shared rooms may not hold a copy of the event.
        if (error?.code === 404 || error?.code === 410) continue;
        outcome = "failed";
        console.error(
          `  ❌ ${label}: ${calendarId}: ${error?.message ?? error}`,
        );
      }
    }

    if (!found && outcome !== "failed") {
      console.log(`  ⏭  ${label}: event ${eventId} not found on any room`);
      outcome = "skipped";
    } else if (outcome === "already-invited") {
      console.log(`  =  ${label}: guests already on the event`);
    }
    counts[outcome] += 1;
  }

  console.log(
    `\n${prefix}${options.apply ? "Invited" : "Would invite"} guests on ${counts.invited} booking(s); ${counts["already-invited"]} already invited, ${counts.skipped} skipped, ${counts.failed} failed.`,
  );
  if (!options.apply) {
    console.log("No changes written. Re-run with --apply to patch the events.");
  }
  if (counts.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
