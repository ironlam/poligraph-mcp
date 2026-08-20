import express, { type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import {
  appendOriginToVary,
  buildAllowedOrigins,
  evaluateOriginHeader,
  getCorsHeaders,
  getOriginLogValue,
  type OriginDecision,
} from "./http-origin.js";

const port = parseInt(process.env.PORT ?? "3001", 10);
const localOrigins = [
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
];
const app = express();

function applyCorsHeaders(
  res: Response,
  decision: Exclude<OriginDecision, { decision: "REJECT" }>,
): void {
  for (const [name, value] of Object.entries(getCorsHeaders(decision))) {
    res.setHeader(name, value);
  }

  if (decision.decision === "ALLOW_WITH_ORIGIN") {
    res.setHeader("Vary", appendOriginToVary(res.getHeader("Vary")));
  }
}

function sendJsonRpcError(
  res: Response,
  status: number,
  code: number,
  message: string,
): void {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json({
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

app.all("/mcp", async (req, res) => {
  const ts = new Date().toISOString();
  let allowedOrigins: ReadonlySet<string>;

  try {
    allowedOrigins = buildAllowedOrigins(
      process.env.MCP_ALLOWED_ORIGINS,
      localOrigins,
    );
  } catch {
    console.error(
      JSON.stringify({ timestamp: ts, event: "ORIGIN_CONFIGURATION_ERROR" }),
    );
    sendJsonRpcError(res, 500, -32603, "Internal error");
    return;
  }

  const originDecision = evaluateOriginHeader(
    req.headers.origin,
    allowedOrigins,
  );

  if (originDecision.decision === "REJECT") {
    console.warn(
      JSON.stringify({
        timestamp: ts,
        event: "ORIGIN_REJECTED",
        reason: originDecision.reason,
        origin: getOriginLogValue(originDecision),
      }),
    );
    sendJsonRpcError(res, 403, -32000, "Forbidden: invalid Origin");
    return;
  }

  applyCorsHeaders(res, originDecision);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (e) {
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, -32603, "Internal error");
    }
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Poligraph MCP HTTP server: http://127.0.0.1:${port}/mcp`);
});
