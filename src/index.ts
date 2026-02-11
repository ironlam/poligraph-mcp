#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPoliticianTools } from "./tools/politicians.js";
import { registerAffairTools } from "./tools/affairs.js";
import { registerVoteTools } from "./tools/votes.js";
import { registerLegislationTools } from "./tools/legislation.js";

const server = new McpServer({
  name: "transparence-politique",
  version: "1.0.0",
});

// Register all tools
registerPoliticianTools(server);
registerAffairTools(server);
registerVoteTools(server);
registerLegislationTools(server);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Transparence Politique MCP server running on stdio");
