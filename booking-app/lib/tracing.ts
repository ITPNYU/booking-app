import * as Sentry from "@sentry/nextjs";

/**
 * Trace database queries as spans in the current transaction.
 */
export async function traceDatabase<T>(
  operation: string,
  table: string,
  callback: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `${table}/${operation}`,
      op: "db",
      attributes: {
        "db.operation": operation,
        "db.table": table,
      },
    },
    async () => {
      try {
        return await callback();
      } catch (error) {
        Sentry.captureException(error, {
          extra: { "db.operation": operation, "db.table": table },
        });
        throw error;
      }
    },
  );
}

/**
 * Trace external API calls as spans in the current transaction.
 */
export async function traceExternalCall<T>(
  serviceName: string,
  method: string,
  callback: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `${serviceName}/${method}`,
      op: "http.client",
      attributes: {
        "external.service": serviceName,
        "external.method": method,
      },
    },
    async () => {
      try {
        return await callback();
      } catch (error) {
        Sentry.captureException(error, {
          extra: { "external.service": serviceName, "external.method": method },
        });
        throw error;
      }
    },
  );
}
