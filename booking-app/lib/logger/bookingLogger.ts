/**
 * Centralized logging utility for booking system
 * Provides consistent logging format across XState, DB operations, and API calls
 */

export interface LogContext {
  calendarEventId?: string;
  tenant?: string;
  email?: string;
  bookingId?: string;
  requestNumber?: number;
  [key: string]: any;
}

export class BookingLogger {
  private static formatTenant(tenant?: string): string {
    return tenant?.toUpperCase() || "UNKNOWN";
  }

  private static formatMessage(
    emoji: string,
    category: string,
    action: string,
    tenant?: string
  ): string {
    return `${emoji} ${category}: ${action} [${this.formatTenant(tenant)}]`;
  }

  private static log(
    level: "log" | "warn" | "error",
    emoji: string,
    category: string,
    action: string,
    context?: LogContext,
    details?: any
  ): void {
    const message = this.formatMessage(
      emoji,
      category,
      action,
      context?.tenant
    );

    if (details) {
      console[level](message, details);
    } else if (context) {
      console[level](message, context);
    } else {
      console[level](message);
    }
  }

  // XState related logs
  static xstateTransition(
    fromState: string,
    toState: string,
    eventType: string,
    context: LogContext
  ): void {
    this.log(
      "log",
      "🔄",
      "XSTATE TRANSITION",
      `${fromState} → ${toState} (${eventType})`,
      context
    );
  }

  static xstateStateEntered(state: string, context: LogContext): void {
    this.log("log", "🏁", "XSTATE STATE", `Entered '${state}' state`, context);
  }

  static xstateActorStarted(actorName: string, context: LogContext): void {
    this.log("log", "🎬", "XSTATE ACTOR", `${actorName} started`, context);
  }

  static xstateActorCompleted(actorName: string, context: LogContext): void {
    this.log("log", "🎬", "XSTATE ACTOR", `${actorName} completed`, context);
  }

  static xstateError(action: string, context: LogContext, error: any): void {
    this.log("error", "🚨", "XSTATE ERROR", action, context, {
      error: error.message,
      stack: error.stack,
    });
  }

  // API related logs
  static apiRequest(
    method: string,
    endpoint: string,
    context: LogContext
  ): void {
    this.log("log", "📡", "API REQUEST", `${method} ${endpoint}`, context);
  }

  static apiSuccess(
    method: string,
    endpoint: string,
    context: LogContext,
    result?: any
  ): void {
    this.log(
      "log",
      "✅",
      "API SUCCESS",
      `${method} ${endpoint}`,
      context,
      result
    );
  }

  static apiError(
    method: string,
    endpoint: string,
    context: LogContext,
    error: any
  ): void {
    this.log("error", "🚨", "API ERROR", `${method} ${endpoint}`, context, {
      error: error.message,
      status: error.status,
    });
  }

  // Database related logs
  static dbOperation(
    operation: string,
    table: string,
    context: LogContext
  ): void {
    this.log("log", "💾", "DB OPERATION", `${operation} ${table}`, context);
  }

  static dbSuccess(
    operation: string,
    table: string,
    context: LogContext
  ): void {
    this.log("log", "✅", "DB SUCCESS", `${operation} ${table}`, context);
  }

  static dbError(
    operation: string,
    table: string,
    context: LogContext,
    error: any
  ): void {
    this.log("error", "🚨", "DB ERROR", `${operation} ${table}`, context, {
      error: error.message,
    });
  }

  // Calendar related logs
  static calendarUpdate(
    action: string,
    context: LogContext,
    details?: any
  ): void {
    this.log("log", "📅", "CALENDAR UPDATE", action, context, details);
  }

  static calendarError(action: string, context: LogContext, error: any): void {
    this.log("error", "🚨", "CALENDAR ERROR", action, context, {
      error: error.message,
    });
  }

  // Email related logs
  static emailSent(
    type: string,
    context: LogContext,
    recipient?: string
  ): void {
    this.log("log", "📧", "EMAIL SENT", type, { ...context, recipient });
  }

  static emailError(type: string, context: LogContext, error: any): void {
    this.log("error", "🚨", "EMAIL ERROR", type, context, {
      error: error.message,
    });
  }

  // Booking status changes
  static statusChange(
    fromStatus: string,
    toStatus: string,
    context: LogContext,
    reason?: string
  ): void {
    this.log(
      "log",
      "🔄",
      "STATUS CHANGE",
      `${fromStatus} → ${toStatus}${reason ? ` (${reason})` : ""}`,
      context
    );
  }

  // Service related logs
  static serviceApproved(serviceType: string, context: LogContext): void {
    this.log("log", "✅", "SERVICE APPROVED", serviceType, context);
  }

  static serviceDeclined(
    serviceType: string,
    context: LogContext,
    reason?: string
  ): void {
    this.log(
      "log",
      "❌",
      "SERVICE DECLINED",
      `${serviceType}${reason ? ` (${reason})` : ""}`,
      context
    );
  }

  static serviceCloseout(serviceType: string, context: LogContext): void {
    this.log("log", "🔒", "SERVICE CLOSEOUT", serviceType, context);
  }

  // Warnings
  static warning(message: string, context: LogContext, details?: any): void {
    this.log("warn", "⚠️", "WARNING", message, context, details);
  }

  // Debug logs (can be easily disabled in production)
  static debug(message: string, context: LogContext, details?: any): void {
    if (process.env.NODE_ENV === "development") {
      this.log("log", "🔍", "DEBUG", message, context, details);
    }
  }

  // Skip/conditional logs
  static skipped(action: string, reason: string, context: LogContext): void {
    this.log("log", "⏭️", "SKIPPED", `${action} - ${reason}`, context);
  }
}
