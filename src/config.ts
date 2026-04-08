import { logger } from "./logging.js";

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Maximum concurrent sessions */
  maxSessions: number;
  /** Default session TTL in milliseconds */
  sessionTtlMs: number;
  /** Session cleanup interval in milliseconds */
  cleanupIntervalMs: number;
  /** Default command timeout in milliseconds */
  commandTimeoutMs: number;
  /** Maximum file size for read operations (bytes) */
  maxFileSize: number;
  /** Enable debug logging */
  debug: boolean;
  /** Rate limiting configuration */
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  /** Security settings */
  security: {
    allowRootLogin: boolean;
    requireHostKeyVerification: boolean;
    allowedCiphers: string[];
  };
}

export const DEFAULT_CONFIG: ServerConfig = {
  maxSessions: 20,
  sessionTtlMs: 900000, // 15 minutes
  cleanupIntervalMs: 10000, // 10 seconds
  commandTimeoutMs: 30000, // 30 seconds
  maxFileSize: 10 * 1024 * 1024, // 10MB
  debug: false,
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000,
  },
  security: {
    allowRootLogin: true,
    requireHostKeyVerification: false,
    allowedCiphers: [],
  },
};

/**
 * Configuration manager with environment variable overrides
 */
export class ConfigManager {
  private config: ServerConfig;

  constructor(overrides: Partial<ServerConfig> = {}) {
    this.config = this.loadConfig(overrides);
    logger.debug("Configuration loaded", { config: this.config });
  }

  private loadConfig(overrides: Partial<ServerConfig>): ServerConfig {
    // Start with defaults
    const config: ServerConfig = {
      ...DEFAULT_CONFIG,
      rateLimit: { ...DEFAULT_CONFIG.rateLimit },
      security: {
        ...DEFAULT_CONFIG.security,
        allowedCiphers: [...DEFAULT_CONFIG.security.allowedCiphers],
      },
    };

    // Apply environment variable overrides
    if (process.env.SSH_MCP_MAX_SESSIONS) {
      config.maxSessions = parseInt(process.env.SSH_MCP_MAX_SESSIONS, 10);
    }
    if (process.env.SSH_MCP_SESSION_TTL) {
      config.sessionTtlMs = parseInt(process.env.SSH_MCP_SESSION_TTL, 10);
    }
    if (process.env.SSH_MCP_COMMAND_TIMEOUT) {
      config.commandTimeoutMs = parseInt(process.env.SSH_MCP_COMMAND_TIMEOUT, 10);
    }
    if (process.env.SSH_MCP_DEBUG === "true") {
      config.debug = true;
    }
    if (process.env.SSH_MCP_RATE_LIMIT === "false") {
      config.rateLimit.enabled = false;
    }
    const strictHostKeyChecking =
      process.env.STRICT_HOST_KEY_CHECKING ?? process.env.SSH_MCP_STRICT_HOST_KEY;
    if (strictHostKeyChecking === "true") {
      config.security.requireHostKeyVerification = true;
    }

    // Apply programmatic overrides last
    return {
      ...config,
      ...overrides,
      rateLimit: {
        ...config.rateLimit,
        ...overrides.rateLimit,
      },
      security: {
        ...config.security,
        ...overrides.security,
        allowedCiphers: overrides.security?.allowedCiphers ?? [...config.security.allowedCiphers],
      },
    };
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  /**
   * Get the entire configuration
   */
  getAll(): Readonly<ServerConfig> {
    return Object.freeze({
      ...this.config,
      rateLimit: Object.freeze({ ...this.config.rateLimit }),
      security: Object.freeze({
        ...this.config.security,
        allowedCiphers: [...this.config.security.allowedCiphers],
      }),
    });
  }

  /**
   * Update configuration at runtime
   */
  update(updates: Partial<ServerConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      rateLimit: {
        ...this.config.rateLimit,
        ...updates.rateLimit,
      },
      security: {
        ...this.config.security,
        ...updates.security,
        allowedCiphers: updates.security?.allowedCiphers ?? [
          ...this.config.security.allowedCiphers,
        ],
      },
    };
    logger.info("Configuration updated", { updates });
  }
}
