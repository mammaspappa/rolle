export async function register() {
  // Server-side Sentry init
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { init } = await import("@sentry/nextjs");
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      init({
        dsn,
        tracesSampleRate: 0.05,
        debug: false,
      });
    }
  }

  // Edge runtime Sentry init
  if (process.env.NEXT_RUNTIME === "edge") {
    const { init } = await import("@sentry/nextjs");
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      init({
        dsn,
        tracesSampleRate: 0.05,
        debug: false,
      });
    }
  }
}
