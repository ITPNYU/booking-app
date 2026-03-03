import { NextRequest, NextResponse } from "next/server";

// Check if New Relic is loaded
let newrelic: any = null;
if (process.env.NEW_RELIC_LICENSE_KEY) {
  try {
    newrelic = require("newrelic");
  } catch (e) {
    console.warn("New Relic not available:", e);
  }
}

/**
 * Wrap API routes with New Relic to trace transactions
 *
 * Example:
 * export const GET = withNewRelic('GET /api/bookings', async (request) => {
 *   // your handler logic
 *   return NextResponse.json({ data });
 * });
 */
export function withNewRelic<
  T extends (...args: any[]) => Promise<NextResponse>,
>(transactionName: string, handler: T): T {
  if (!newrelic) {
    // Return original handler if New Relic is not available
    return handler;
  }

  return (async (...args: any[]) =>
    await newrelic.startWebTransaction(transactionName, async () => {
      const transaction = newrelic.getTransaction();

      try {
        // Add request parameters as custom attributes
        if (args[0] instanceof NextRequest) {
          const request = args[0];
          const url = new URL(request.url);

          // Add custom attributes
          newrelic.addCustomAttributes({
            "request.method": request.method,
            "request.path": url.pathname,
            "request.query": url.search,
          });
        }

        const startTime = Date.now();
        const response = await handler(...args);
        const duration = Date.now() - startTime;

        // Add response information as custom attributes
        newrelic.addCustomAttributes({
          "response.status": response.status,
          "response.duration": duration,
        });

        return response;
      } catch (error) {
        // Report error to New Relic
        newrelic.noticeError(error);
        throw error;
      } finally {
        transaction?.end();
      }
    })) as T;
}

/**
 * Record custom metrics
 *
 * Example:
 * recordMetric('Database/Query/Duration', duration);
 */
export function recordMetric(name: string, value: number) {
  if (newrelic) {
    newrelic.recordMetric(name, value);
  }
}

/**
 * Add custom attributes
 *
 * Example:
 * addCustomAttributes({ userId: '123', calendarId: 'cal-456' });
 */
export function addCustomAttributes(
  attributes: Record<string, string | number | boolean>,
) {
  if (newrelic) {
    newrelic.addCustomAttributes(attributes);
  }
}

/**
 * Record custom events
 *
 * Example:
 * recordCustomEvent('BookingCreated', { roomId: '123', duration: 60 });
 */
export function recordCustomEvent(
  eventType: string,
  attributes: Record<string, any>,
) {
  if (newrelic) {
    newrelic.recordCustomEvent(eventType, attributes);
  }
}

/**
 * Record errors
 *
 * Example:
 * noticeError(error, { userId: '123', operation: 'createBooking' });
 */
export function noticeError(
  error: Error,
  customAttributes?: Record<string, any>,
) {
  if (newrelic) {
    newrelic.noticeError(error, customAttributes);
  }
}

/**
 * Trace database queries as segments in the current transaction.
 *
 * Example:
 * await traceDatabase('Firestore/bookings/get', async () => {
 *   return await db.collection('bookings').doc(id).get();
 * });
 */
export async function traceDatabase<T>(
  operation: string,
  table: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!newrelic) {
    return callback();
  }

  return newrelic.startSegment(`${table}/${operation}`, true, async () => {
    try {
      return await callback();
    } catch (error) {
      noticeError(error as Error, {
        "db.operation": operation,
        "db.table": table,
      });
      throw error;
    }
  });
}

/**
 * Trace external API calls as segments in the current transaction.
 *
 * Example:
 * await traceExternalCall('GoogleCalendar', 'events.insert', async () => {
 *   return await calendar.events.insert({ ... });
 * });
 */
export async function traceExternalCall<T>(
  serviceName: string,
  method: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!newrelic) {
    return callback();
  }

  return newrelic.startSegment(`${serviceName}/${method}`, true, async () => {
    try {
      return await callback();
    } catch (error) {
      noticeError(error as Error, {
        "external.service": serviceName,
        "external.method": method,
      });
      throw error;
    }
  });
}

export { newrelic };
