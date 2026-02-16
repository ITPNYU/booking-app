"use strict";
/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || "Booking App"],
  /**
   * Your New Relic license key.
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  /**
   * This setting controls distributed tracing.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before you enable
   * this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing
   * Default is true.
   */
  distributed_tracing: {
    /**
     * Enables/disables distributed tracing.
     *
     * @env NEW_RELIC_DISTRIBUTED_TRACING_ENABLED
     */
    enabled: true,
  },
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: process.env.NEW_RELIC_LOG_LEVEL || "info",
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered.
     *
     * @env NEW_RELIC_ATTRIBUTES_EXCLUDE
     */
    exclude: [
      "request.headers.cookie",
      "request.headers.authorization",
      "request.headers.proxyAuthorization",
      "request.headers.setCookie*",
      "request.headers.x*",
      "response.headers.cookie",
      "response.headers.authorization",
      "response.headers.proxyAuthorization",
      "response.headers.setCookie*",
      "response.headers.x*",
    ],
  },
  /**
   * Application performance monitoring settings
   */
  application_logging: {
    forwarding: {
      /**
       * Enables forwarding application logs to New Relic
       */
      enabled: true,
    },
  },
  /**
   * Transaction tracer settings
   */
  transaction_tracer: {
    /**
     * Enables/disables transaction tracer
     */
    enabled: true,
    /**
     * Threshold (in milliseconds) at which the transaction tracer will begin
     * tracing a transaction's traces. If set to 0, all transactions will be traced.
     */
    transaction_threshold: process.env.NEW_RELIC_TRACER_THRESHOLD || "apdex_f",
    /**
     * Whether to collect & submit slow SQL queries
     */
    record_sql: "obfuscated",
    /**
     * If enabled, explains slow SQL queries
     */
    explain_threshold: 500,
  },
  /**
   * Error collector settings
   */
  error_collector: {
    /**
     * This is used to configure error collection.
     * For more details see: https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration
     */
    enabled: true,
    /**
     * List of HTTP error status codes the error tracer should discard.
     */
    ignore_status_codes: [404],
  },
  /**
   * Custom instrumentation for Next.js API routes
   */
  api: {
    /**
     * Custom attributes for API routes
     */
    custom_parameters_enabled: true,
  },
};
