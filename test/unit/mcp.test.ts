import { afterAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createTestContainer, type AppContainer } from "../../src/container.js";
import { logger } from "../../src/logging.js";
import { SERVER_VERSION, SSHMCPServer } from "../../src/mcp.js";

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};

const handlerMap = new WeakMap<object, Map<unknown, (request?: unknown) => Promise<unknown>>>();

const connectSpy = jest.spyOn(Server.prototype as any, "connect").mockResolvedValue(undefined);
const setRequestHandlerSpy = jest
  .spyOn(Server.prototype as any, "setRequestHandler")
  .mockImplementation(function (
    this: object,
    schema: unknown,
    handler: (request?: unknown) => Promise<unknown>,
  ) {
    const handlers = handlerMap.get(this) ?? new Map();
    handlers.set(schema, handler);
    handlerMap.set(this, handlers);
  } as any);

function getHandlers(server: SSHMCPServer) {
  const internalServer = (server as unknown as { server: object }).server;
  const handlers = handlerMap.get(internalServer);
  if (!handlers) {
    throw new Error("request handlers were not registered");
  }
  return handlers;
}

async function destroyContainer(container: AppContainer): Promise<void> {
  container.rateLimiter.destroy();
  await container.sessionManager.destroy();
}

describe("SSHMCPServer", () => {
  const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => undefined);
  const errorSpy = jest.spyOn(logger, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    connectSpy.mockClear();
    infoSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    connectSpy.mockRestore();
    setRequestHandlerSpy.mockRestore();
  });

  test("exposes the server version constant", () => {
    expect(SERVER_VERSION).toBe(packageVersion.version);
  });

  test("registers handlers and delegates tool calls when rate limiting is disabled", async () => {
    const container = createTestContainer();
    const rateCheckSpy = jest.spyOn(container.rateLimiter, "check");
    const server = new SSHMCPServer(container);
    const handlers = getHandlers(server);

    await expect(handlers.get(ListResourcesRequestSchema)?.()).resolves.toEqual({
      resources: [],
    });

    await expect(handlers.get(ListToolsRequestSchema)?.()).resolves.toEqual(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "ssh_open_session" }),
          expect.objectContaining({ name: "get_metrics" }),
        ]),
      }),
    );

    const result = (await handlers.get(CallToolRequestSchema)?.({
      params: { name: "ssh_list_sessions", arguments: {} },
    })) as {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
      count?: number;
      sessions?: unknown[];
    };

    expect(result.isError).toBeUndefined();
    expect(payload.count).toBe(0);
    expect(payload.sessions).toEqual([]);
    expect(rateCheckSpy).not.toHaveBeenCalled();

    await destroyContainer(container);
  });

  test("returns an error response when the rate limit blocks a tool call", async () => {
    const base = createTestContainer();
    const container = {
      ...base,
      config: {
        get: jest.fn((key: string) =>
          key === "rateLimit" ? { enabled: true } : base.config.get(key as never),
        ),
      },
      rateLimiter: {
        check: jest.fn(() => ({ allowed: false, resetIn: 1234 })),
        destroy: jest.fn(),
      },
    } as unknown as AppContainer;

    const server = new SSHMCPServer(container);
    const handlers = getHandlers(server);

    await expect(
      handlers.get(CallToolRequestSchema)?.({
        params: { name: "ssh_list_sessions", arguments: {} },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        isError: true,
        content: [
          expect.objectContaining({
            text: expect.stringContaining('"code": "ERATELIMIT"'),
          }),
        ],
      }),
    );

    expect(container.rateLimiter.check as any).toHaveBeenCalledWith("global");

    await destroyContainer(base);
  });

  test("logs server errors and connects transports in run()", async () => {
    const container = createTestContainer();
    const server = new SSHMCPServer(container);
    const internalServer = (
      server as unknown as {
        server: { onerror?: (error: Error) => void };
      }
    ).server;

    internalServer.onerror?.(new Error("boom"));
    await server.run();

    expect(errorSpy).toHaveBeenCalledWith("Server error", {
      error: "boom",
    });
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("SSH MCP Server started successfully");

    await destroyContainer(container);
  });
});
