#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const logger = new Logger(config.logLevel);
  const server = createMcpServer({ config, logger });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async (): Promise<void> => {
    try {
      await server.close();
    } catch (err) {
      logger.error("Error during shutdown", err);
    }
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main();
