import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow dev server to be accessed from other machines on the network.
  // Next.js 14 does not support wildcards here — list specific IPs/hosts.
  // Add your machine's IP if it changes.
  allowedDevOrigins: ["91.223.169.40"],
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Only upload source maps when SENTRY_AUTH_TOKEN is present
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Disable source map upload if no auth token is configured
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  // Prevents Sentry from being tree-shaken when DSN is not set
  hideSourceMaps: true,
  widenClientFileUpload: true,
});
