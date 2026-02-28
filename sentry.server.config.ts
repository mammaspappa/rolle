import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Trace 5% of requests for performance monitoring
    tracesSampleRate: 0.05,
    debug: false,
  });
}
