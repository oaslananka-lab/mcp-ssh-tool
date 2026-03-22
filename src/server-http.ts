import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { SSHMCPServer } from "./mcp.js";
import { logger } from "./logging.js";
import { sessionManager } from "./session.js";

interface HttpSession {
  server: SSHMCPServer;
  transport: SSEServerTransport;
}

const port = Number(process.env.PORT || 3000);
const endpoint = "/mcp";
const sessions = new Map<string, HttpSession>();

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

async function handleSseConnection(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const transport = new SSEServerTransport(endpoint, res);
  const sessionId = transport.sessionId;
  const server = new SSHMCPServer();

  transport.onclose = () => {
    sessions.delete(sessionId);
    logger.info("HTTP/SSE MCP session closed", { sessionId });
  };

  transport.onerror = (error) => {
    logger.error("HTTP/SSE transport error", { sessionId, error: error.message });
  };

  sessions.set(sessionId, { server, transport });

  try {
    await server.connect(transport);
    logger.info("HTTP/SSE MCP session established", { sessionId });
  } catch (error) {
    sessions.delete(sessionId);
    logger.error("Failed to establish HTTP/SSE MCP session", { error });
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Failed to establish MCP SSE session" });
    }
  }
}

async function handleMessagePost(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const baseUrl = `http://${req.headers.host || "localhost"}`;
  const requestUrl = new URL(req.url || endpoint, baseUrl);
  const sessionId = requestUrl.searchParams.get("sessionId");

  if (!sessionId) {
    sendJson(res, 400, { error: "Missing sessionId query parameter" });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    sendJson(res, 404, { error: "Session not found" });
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    logger.error("Failed to handle HTTP/SSE MCP message", {
      sessionId,
      error,
    });
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Failed to process MCP message" });
    }
  }
}

const httpServer = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || endpoint, "http://localhost");

  if (requestUrl.pathname === "/.well-known/openai-apps-challenge") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("cxYvVGiJrMx7VjCg1z8KmodNB6dR7RyPLWpW7Lcy2Kg");
    return;
  }

  if (requestUrl.pathname !== endpoint) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "GET") {
    await handleSseConnection(req, res);
    return;
  }

  if (req.method === "POST") {
    await handleMessagePost(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) {
    process.exit(0);
  }

  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down HTTP/SSE server...`);

  httpServer.close();

  await Promise.all(
    Array.from(sessions.entries()).map(async ([sessionId, session]) => {
      try {
        await session.transport.close();
      } catch (error) {
        logger.warn("Failed to close HTTP/SSE transport cleanly", {
          sessionId,
          error,
        });
      }
    }),
  );
  sessions.clear();

  await sessionManager.destroy();
  process.exit(0);
}

httpServer.listen(port, "0.0.0.0", () => {
  logger.info("HTTP/SSE MCP server listening", { port, endpoint });
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
