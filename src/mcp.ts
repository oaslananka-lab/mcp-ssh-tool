import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AppContainer } from "./container.js";
import { logger } from "./logging.js";
import { createToolRegistry } from "./tools/index.js";

export const SERVER_VERSION = "1.3.2";

export class SSHMCPServer {
  private readonly server: Server;
  private readonly registry: ReturnType<typeof createToolRegistry>;

  constructor(private readonly container: AppContainer) {
    this.server = new Server(
      {
        name: "ssh-mcp-server",
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );
    this.registry = createToolRegistry(container);

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registry.getAllTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (this.container.config.get("rateLimit").enabled) {
        const rateCheck = this.container.rateLimiter.check("global");
        if (!rateCheck.allowed) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    error: true,
                    code: "ERATELIMIT",
                    message: `Rate limit exceeded for tool: ${name}`,
                    resetIn: rateCheck.resetIn,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }
      }

      return this.registry.dispatch(name, args ?? {});
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error("Server error", {
        error: error instanceof Error ? error.message : String(error),
      });
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.connect(transport);
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
    logger.info("SSH MCP Server started successfully");
  }
}
