import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10% of sessions for session replay in production
    replaysSessionSampleRate: 0.1,
    // Always capture replays for sessions with errors
    replaysOnErrorSampleRate: 1.0,
    // Trace 5% of requests for performance monitoring
    tracesSampleRate: 0.05,
    debug: false,
    integrations: [
      Sentry.replayIntegration(),
    ],
  });
}
