import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Connection options for BullMQ (avoids the bundled-ioredis version type clash).
 * Pass this to Queue / Worker constructors instead of the IORedis instance.
 */
export const bullConnection = {
  host: (() => {
    try {
      return new URL(process.env.REDIS_URL ?? "redis://localhost:6379").hostname;
    } catch {
      return "localhost";
    }
  })(),
  port: (() => {
    try {
      return Number(new URL(process.env.REDIS_URL ?? "redis://localhost:6379").port) || 6379;
    } catch {
      return 6379;
    }
  })(),
};
