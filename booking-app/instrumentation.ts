export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Initialize New Relic
    if (process.env.NEW_RELIC_LICENSE_KEY) {
      await import("newrelic");
    }
  }
}
