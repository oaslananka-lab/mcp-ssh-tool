import { afterEach, describe, expect, test } from "@jest/globals";
import { ConfigManager } from "../../src/config.js";

describe("ConfigManager", () => {
  afterEach(() => {
    delete process.env.SSH_MCP_MAX_SESSIONS;
    delete process.env.SSH_MCP_SESSION_TTL;
    delete process.env.SSH_MCP_COMMAND_TIMEOUT;
    delete process.env.SSH_MCP_DEBUG;
    delete process.env.SSH_MCP_RATE_LIMIT;
    delete process.env.SSH_MCP_STRICT_HOST_KEY;
    delete process.env.STRICT_HOST_KEY_CHECKING;
  });

  test("uses default values", () => {
    const config = new ConfigManager();

    expect(config.get("maxSessions")).toBe(20);
    expect(config.get("debug")).toBe(false);
    expect(config.get("rateLimit").enabled).toBe(true);
  });

  test("reads environment overrides", () => {
    process.env.SSH_MCP_MAX_SESSIONS = "42";
    process.env.SSH_MCP_SESSION_TTL = "5000";
    process.env.SSH_MCP_COMMAND_TIMEOUT = "7000";
    process.env.SSH_MCP_DEBUG = "true";
    process.env.SSH_MCP_RATE_LIMIT = "false";
    process.env.SSH_MCP_STRICT_HOST_KEY = "true";

    const config = new ConfigManager();

    expect(config.get("maxSessions")).toBe(42);
    expect(config.get("sessionTtlMs")).toBe(5000);
    expect(config.get("commandTimeoutMs")).toBe(7000);
    expect(config.get("debug")).toBe(true);
    expect(config.get("rateLimit").enabled).toBe(false);
    expect(config.get("security").requireHostKeyVerification).toBe(true);
  });

  test("reads STRICT_HOST_KEY_CHECKING as the preferred host verification flag", () => {
    process.env.STRICT_HOST_KEY_CHECKING = "true";

    const config = new ConfigManager();

    expect(config.get("security").requireHostKeyVerification).toBe(true);
  });

  test("programmatic overrides take precedence and merge nested values", () => {
    process.env.SSH_MCP_MAX_SESSIONS = "5";

    const config = new ConfigManager({
      maxSessions: 99,
      rateLimit: { enabled: true, maxRequests: 5, windowMs: 1000 },
      security: {
        allowedCiphers: ["aes256-gcm"],
        allowRootLogin: false,
        requireHostKeyVerification: true,
      },
    });

    expect(config.get("maxSessions")).toBe(99);
    expect(config.get("rateLimit")).toEqual({
      enabled: true,
      maxRequests: 5,
      windowMs: 1000,
    });
    expect(config.get("security")).toEqual({
      allowRootLogin: false,
      requireHostKeyVerification: true,
      allowedCiphers: ["aes256-gcm"],
    });
  });

  test("getAll returns frozen copies", () => {
    const config = new ConfigManager();
    const all = config.getAll();

    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(all.rateLimit)).toBe(true);
    expect(Object.isFrozen(all.security)).toBe(true);
    expect(all).not.toBe(config.getAll());
  });

  test("update changes runtime values", () => {
    const config = new ConfigManager();
    config.update({
      debug: true,
      rateLimit: { enabled: false, maxRequests: 25, windowMs: 5000 },
    });

    expect(config.get("debug")).toBe(true);
    expect(config.get("rateLimit")).toEqual({
      enabled: false,
      maxRequests: 25,
      windowMs: 5000,
    });
  });
});
