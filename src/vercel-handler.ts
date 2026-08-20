import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer } from "./server.js";
import {
  appendOriginToVary,
  buildAllowedOrigins,
  evaluateOriginHeader,
  getCorsHeaders,
  getOriginLogValue,
  type OriginDecision,
} from "./http-origin.js";

export interface StreamableHttpTransportLifecycle extends Transport {
  handleRequest(
    req: VercelRequest,
    res: VercelResponse,
    parsedBody?: unknown,
  ): Promise<void>;
}

export interface McpServerLifecycle {
  connect(transport: StreamableHttpTransportLifecycle): Promise<void>;
  close(): Promise<void>;
}

export interface VercelHandlerDependencies {
  createMcpServer(): McpServerLifecycle;
  createTransport(): StreamableHttpTransportLifecycle;
}

const defaultDependencies: VercelHandlerDependencies = {
  createMcpServer: createServer,
  createTransport: () =>
    new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    }),
};

function applyCorsHeaders(
  res: VercelResponse,
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
  res: VercelResponse,
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

async function handleRequest(
  req: VercelRequest,
  res: VercelResponse,
  dependencies: VercelHandlerDependencies,
) {
  const ts = new Date().toISOString();
  let allowedOrigins: ReadonlySet<string>;

  try {
    allowedOrigins = buildAllowedOrigins(process.env.MCP_ALLOWED_ORIGINS);
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

  const ua = req.headers["user-agent"] ?? "unknown";
  const accept = req.headers["accept"] ?? "none";

  // Keep operational metadata only. Tool arguments may contain user queries and
  // must not be copied to infrastructure logs.
  if (Array.isArray(req.body)) {
    for (const msg of req.body) {
      console.log(
        `[${ts}] ${req.method} ${msg.method ?? "notification"} | id=${msg.id ?? "-"} | ua=${ua} | accept=${accept}`,
      );
    }
  } else if (req.body?.method) {
    console.log(
      `[${ts}] ${req.method} ${req.body.method} | id=${req.body.id ?? "-"} | ua=${ua} | accept=${accept}`,
    );
  } else {
    console.log(`[${ts}] ${req.method} (no body) | ua=${ua} | accept=${accept}`);
  }

  try {
    const server = dependencies.createMcpServer();
    const transport = dependencies.createTransport();

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error(`[${ts}] ERROR:`, e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
}

export function createVercelHandler(
  dependencies: VercelHandlerDependencies = defaultDependencies,
) {
  return (req: VercelRequest, res: VercelResponse) =>
    handleRequest(req, res, dependencies);
}

export default createVercelHandler();
