import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { RateLimiter } from "../../src/rate-limiter.js";

describe("RateLimiter (sliding window)", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000,
      blockOnLimit: true,
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  test("allows requests below the limit", () => {
    expect(rateLimiter.check("k").allowed).toBe(true);
    expect(rateLimiter.check("k").allowed).toBe(true);
    expect(rateLimiter.check("k").allowed).toBe(true);
  });

  test("blocks the request that exceeds the limit", () => {
    rateLimiter.check("k");
    rateLimiter.check("k");
    rateLimiter.check("k");

    const result = rateLimiter.check("k");
    expect(result.allowed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.remaining).toBe(0);
  });

  test("reports usage and reset window", () => {
    rateLimiter.check("k");
    rateLimiter.check("k");

    const usage = rateLimiter.getUsage("k");
    expect(usage).toEqual(
      expect.objectContaining({
        count: 2,
        remaining: 1,
      }),
    );
    expect(usage?.resetIn).toBeGreaterThan(0);
  });

  test("old requests fall out of the window", async () => {
    const fastLimiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 50,
      blockOnLimit: true,
    });

    fastLimiter.check("k");
    fastLimiter.check("k");
    expect(fastLimiter.check("k").allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(fastLimiter.check("k").allowed).toBe(true);
    fastLimiter.destroy();
  });

  test("does not allow a burst after a fixed-window-style reset point", async () => {
    let now = 0;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
    const burstLimiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 100,
      blockOnLimit: true,
    });

    for (let index = 0; index < 5; index++) {
      burstLimiter.check("k");
    }

    expect(burstLimiter.check("k").allowed).toBe(false);
    now = 60;
    expect(burstLimiter.check("k").allowed).toBe(false);

    burstLimiter.destroy();
    nowSpy.mockRestore();
  });

  test("reset clears a key", () => {
    rateLimiter.check("k");
    rateLimiter.check("k");
    rateLimiter.reset("k");

    expect(rateLimiter.check("k").allowed).toBe(true);
  });

  test("returns null for unknown or expired keys", async () => {
    expect(rateLimiter.getUsage("missing")).toBeNull();

    const fastLimiter = new RateLimiter({
      maxRequests: 1,
      windowMs: 20,
      blockOnLimit: true,
    });
    fastLimiter.check("k");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fastLimiter.getUsage("k")).toBeNull();
    fastLimiter.destroy();
  });

  test("independent keys do not interfere", () => {
    rateLimiter.check("a");
    rateLimiter.check("a");
    rateLimiter.check("a");

    expect(rateLimiter.check("b").allowed).toBe(true);
  });

  test("non-blocking mode still reports exceeded usage", () => {
    const permissiveLimiter = new RateLimiter({
      maxRequests: 1,
      windowMs: 1000,
      blockOnLimit: false,
    });

    permissiveLimiter.check("k");
    const result = permissiveLimiter.check("k");

    expect(result.allowed).toBe(true);
    expect(result.blocked).toBe(false);
    permissiveLimiter.destroy();
  });
});
