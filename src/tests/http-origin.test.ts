import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  createVercelHandler,
  type McpServerLifecycle,
  type StreamableHttpTransportLifecycle,
} from "../vercel-handler.js";
import {
  CORS_ALLOW_HEADERS,
  CORS_EXPOSE_HEADERS,
  DEFAULT_ALLOWED_ORIGINS,
  OriginConfigurationError,
  appendOriginToVary,
  buildAllowedOrigins,
  evaluateOriginHeader,
  getCorsHeaders,
  getOriginLogValue,
  normalizeOrigin,
} from "../http-origin.js";

const originalAllowedOrigins = process.env.MCP_ALLOWED_ORIGINS;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

afterEach(() => {
  if (originalAllowedOrigins === undefined) {
    delete process.env.MCP_ALLOWED_ORIGINS;
  } else {
    process.env.MCP_ALLOWED_ORIGINS = originalAllowedOrigins;
  }
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
});

test("the default allowlist contains both PoliGraph endpoints", () => {
  const allowed = buildAllowedOrigins(undefined);

  assert.deepEqual(
    [...allowed].sort(),
    [...DEFAULT_ALLOWED_ORIGINS].sort(),
  );
});

test("an additional HTTPS origin can be configured", () => {
  const allowed = buildAllowedOrigins("https://connector.example");

  assert.equal(allowed.has("https://connector.example"), true);
});

test("multiple configured origins are normalized and deduplicated", () => {
  const allowed = buildAllowedOrigins(
    "https://one.example, https://two.example,https://one.example",
  );

  assert.equal(allowed.has("https://one.example"), true);
  assert.equal(allowed.has("https://two.example"), true);
  assert.equal(allowed.size, DEFAULT_ALLOWED_ORIGINS.length + 2);
});

test("an empty configured entry does not expand the allowlist", () => {
  const allowed = buildAllowedOrigins(" ,  ,");

  assert.deepEqual(
    [...allowed].sort(),
    [...DEFAULT_ALLOWED_ORIGINS].sort(),
  );
});

test("a wildcard is rejected as invalid configuration", () => {
  assert.throws(
    () => buildAllowedOrigins("*"),
    OriginConfigurationError,
  );
});

test("one invalid configured entry fails the complete configuration closed", () => {
  assert.throws(
    () =>
      buildAllowedOrigins(
        "https://connector.example,https://invalid.example/path",
      ),
    OriginConfigurationError,
  );
});

test("the null origin is invalid", () => {
  assert.equal(normalizeOrigin("null"), undefined);
});

test("remote HTTP origins are invalid", () => {
  assert.equal(normalizeOrigin("http://connector.example"), undefined);
});

test("HTTP loopback origins are valid", () => {
  assert.equal(normalizeOrigin("http://localhost:3001"), "http://localhost:3001");
  assert.equal(
    normalizeOrigin("http://127.0.0.1:3001"),
    "http://127.0.0.1:3001",
  );
  assert.equal(normalizeOrigin("http://[::1]:3001"), "http://[::1]:3001");
});

test("the local server origins can be added without widening remote HTTP", () => {
  const allowed = buildAllowedOrigins(undefined, [
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ]);

  assert.equal(allowed.has("http://127.0.0.1:3001"), true);
  assert.equal(allowed.has("http://localhost:3001"), true);
  assert.equal(allowed.has("http://connector.example"), false);
});

test("an origin with a path is invalid", () => {
  assert.equal(normalizeOrigin("https://connector.example/path"), undefined);
});

test("an origin with a query string is invalid", () => {
  assert.equal(normalizeOrigin("https://connector.example?key=value"), undefined);
});

test("an origin with a fragment is invalid", () => {
  assert.equal(normalizeOrigin("https://connector.example#fragment"), undefined);
});

test("an origin with a username or password is invalid", () => {
  assert.equal(normalizeOrigin("https://user@connector.example"), undefined);
  assert.equal(
    normalizeOrigin("https://user:password@connector.example"),
    undefined,
  );
});

test("an absent Origin header is accepted without an origin", () => {
  const decision = evaluateOriginHeader(
    undefined,
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, { decision: "ALLOW_WITHOUT_ORIGIN" });
});

test("the canonical PoliGraph Origin is accepted", () => {
  const decision = evaluateOriginHeader(
    "https://mcp.poligraph.fr",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "ALLOW_WITH_ORIGIN",
    origin: "https://mcp.poligraph.fr",
  });
});

test("the Vercel compatibility Origin is accepted", () => {
  const decision = evaluateOriginHeader(
    "https://poligraph-mcp.vercel.app",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "ALLOW_WITH_ORIGIN",
    origin: "https://poligraph-mcp.vercel.app",
  });
});

test("an explicitly configured Origin is accepted", () => {
  const decision = evaluateOriginHeader(
    "https://connector.example",
    buildAllowedOrigins("https://connector.example"),
  );

  assert.deepEqual(decision, {
    decision: "ALLOW_WITH_ORIGIN",
    origin: "https://connector.example",
  });
});

test("a valid but unauthorized Origin is rejected", () => {
  const decision = evaluateOriginHeader(
    "https://evil.example",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "REJECT",
    reason: "ORIGIN_NOT_ALLOWED",
    normalizedOrigin: "https://evil.example",
  });
});

test("a malformed Origin is rejected without a loggable raw value", () => {
  const decision = evaluateOriginHeader(
    "not an origin",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "REJECT",
    reason: "INVALID_ORIGIN",
  });
  assert.equal(getOriginLogValue(decision), "<invalid>");
});

test("a normalized Origin log value is bounded", () => {
  const value = getOriginLogValue({
    decision: "REJECT",
    reason: "ORIGIN_NOT_ALLOWED",
    normalizedOrigin: `https://${"a".repeat(500)}.example`,
  });

  assert.equal(value.length, 200);
});

test("multiple Origin header values are rejected", () => {
  const decision = evaluateOriginHeader(
    ["https://mcp.poligraph.fr", "https://evil.example"],
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "REJECT",
    reason: "MULTIPLE_ORIGIN_VALUES",
  });
});

test("an Origin string containing a comma is rejected", () => {
  const decision = evaluateOriginHeader(
    "https://mcp.poligraph.fr, https://evil.example",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "REJECT",
    reason: "MULTIPLE_ORIGIN_VALUES",
  });
});

test("an incoming null Origin is rejected", () => {
  const decision = evaluateOriginHeader(
    "null",
    buildAllowedOrigins(undefined),
  );

  assert.deepEqual(decision, {
    decision: "REJECT",
    reason: "NULL_ORIGIN",
  });
});

test("CORS reflects an authorized Origin exactly and preserves Vary", () => {
  const decision = evaluateOriginHeader(
    "https://mcp.poligraph.fr",
    buildAllowedOrigins(undefined),
  );
  if (decision.decision === "REJECT") {
    assert.fail("the default Origin must be accepted");
  }

  const headers = getCorsHeaders(decision);
  assert.equal(
    headers["Access-Control-Allow-Origin"],
    "https://mcp.poligraph.fr",
  );
  assert.equal(appendOriginToVary("Accept-Encoding"), "Accept-Encoding, Origin");
  assert.equal(
    appendOriginToVary("accept-encoding, origin"),
    "accept-encoding, origin",
  );
});

test("CORS omits ACAO when Origin is absent", () => {
  const decision = evaluateOriginHeader(
    undefined,
    buildAllowedOrigins(undefined),
  );
  if (decision.decision === "REJECT") {
    assert.fail("an absent Origin must be accepted");
  }

  const headers = getCorsHeaders(decision);
  assert.equal(headers["Access-Control-Allow-Origin"], undefined);
});

test("CORS never uses a wildcard and exposes the required MCP headers", () => {
  const decision = evaluateOriginHeader(
    "https://mcp.poligraph.fr",
    buildAllowedOrigins(undefined),
  );
  if (decision.decision === "REJECT") {
    assert.fail("the default Origin must be accepted");
  }

  const headers = getCorsHeaders(decision);
  assert.equal(Object.values(headers).includes("*"), false);
  assert.match(CORS_ALLOW_HEADERS, /MCP-Protocol-Version/);
  assert.match(CORS_ALLOW_HEADERS, /Mcp-Session-Id/);
  assert.match(CORS_ALLOW_HEADERS, /Last-Event-ID/);
  assert.equal(CORS_EXPOSE_HEADERS, "Mcp-Session-Id");
});

type Handler = ReturnType<typeof createVercelHandler>;
type HandlerRequest = Parameters<Handler>[0];
type HandlerResponse = Parameters<Handler>[1];

interface ResponseOnCall {
  event: string;
  listener: (...args: unknown[]) => void;
}

interface MockResponseState {
  body: unknown;
  headers: Map<string, string | string[] | number>;
  responseOnCalls: ResponseOnCall[];
  statusCode: number;
}

function createRequest(
  method: string,
  origin?: string | string[],
  body?: unknown,
): HandlerRequest {
  return {
    method,
    headers: origin === undefined ? {} : { origin },
    body,
  } as HandlerRequest;
}

function createResponse(): {
  response: HandlerResponse;
  state: MockResponseState;
} {
  const state: MockResponseState = {
    body: undefined,
    headers: new Map(),
    responseOnCalls: [],
    statusCode: 200,
  };

  const response = {
    headersSent: false,
    setHeader(name: string, value: string | string[] | number) {
      state.headers.set(name.toLowerCase(), value);
      return response;
    },
    getHeader(name: string) {
      return state.headers.get(name.toLowerCase());
    },
    status(statusCode: number) {
      state.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      response.headersSent = true;
      return response;
    },
    end() {
      response.headersSent = true;
      return response;
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      state.responseOnCalls.push({ event, listener });
      return response;
    },
  };

  return { response: response as unknown as HandlerResponse, state };
}

interface HandlerCallCounts {
  createMcpServer: number;
  createTransport: number;
  serverClose: number;
  serverConnect: number;
  transportClose: number;
  transportHandleRequest: number;
}

interface TransportHandleRequestCall {
  parsedBody: unknown;
  request: HandlerRequest;
  response: HandlerResponse;
}

interface HandlerTestContext {
  calls: HandlerCallCounts;
  handler: Handler;
  response: HandlerResponse;
  responseState: MockResponseState;
  server: McpServerLifecycle;
  serverConnectTransports: StreamableHttpTransportLifecycle[];
  transport: StreamableHttpTransportLifecycle;
  transportHandleRequestCalls: TransportHandleRequestCall[];
}

function createHandlerTestContext(): HandlerTestContext {
  const calls: HandlerCallCounts = {
    createMcpServer: 0,
    createTransport: 0,
    serverClose: 0,
    serverConnect: 0,
    transportClose: 0,
    transportHandleRequest: 0,
  };
  const serverConnectTransports: StreamableHttpTransportLifecycle[] = [];
  const transportHandleRequestCalls: TransportHandleRequestCall[] = [];
  const { response, state: responseState } = createResponse();

  const transport: StreamableHttpTransportLifecycle = {
    async start() {},
    async send() {},
    async close() {
      calls.transportClose += 1;
    },
    async handleRequest(request, handlerResponse, parsedBody) {
      calls.transportHandleRequest += 1;
      transportHandleRequestCalls.push({
        parsedBody,
        request,
        response: handlerResponse,
      });
      handlerResponse.status(200).end();
    },
  };

  const server: McpServerLifecycle = {
    async connect(connectedTransport) {
      calls.serverConnect += 1;
      serverConnectTransports.push(connectedTransport);
    },
    async close() {
      calls.serverClose += 1;
    },
  };

  const handler = createVercelHandler({
    createMcpServer() {
      calls.createMcpServer += 1;
      return server;
    },
    createTransport() {
      calls.createTransport += 1;
      return transport;
    },
  });

  return {
    calls,
    handler,
    response,
    responseState,
    server,
    serverConnectTransports,
    transport,
    transportHandleRequestCalls,
  };
}

function assertNoMcpResourceInitialization(
  context: HandlerTestContext,
  scenario: string,
): void {
  assert.equal(
    context.calls.createMcpServer,
    0,
    `${scenario}: a short path must not create an MCP server`,
  );
  assert.equal(
    context.calls.createTransport,
    0,
    `${scenario}: a short path must not create an MCP transport`,
  );
  assert.equal(
    context.responseState.responseOnCalls.length,
    0,
    `${scenario}: a short path must not register a response listener`,
  );
  assert.equal(
    context.calls.serverConnect,
    0,
    `${scenario}: a short path must not connect an MCP server`,
  );
  assert.equal(
    context.calls.transportHandleRequest,
    0,
    `${scenario}: a short path must not invoke the MCP transport`,
  );
}

test("the Vercel handler rejects a forbidden POST without reflecting it", async () => {
  console.warn = () => {};
  const context = createHandlerTestContext();
  const request = createRequest("POST", "https://evil.example", {
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
  });

  await context.handler(request, context.response);

  assert.equal(context.responseState.statusCode, 403);
  assert.deepEqual(context.responseState.body, {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Forbidden: invalid Origin" },
    id: null,
  });
  assert.doesNotMatch(
    JSON.stringify(context.responseState.body),
    /evil\.example/,
  );
  assert.match(
    String(context.responseState.headers.get("content-type")),
    /application\/json/,
  );
  assertNoMcpResourceInitialization(context, "forbidden POST");
});

test("the Vercel handler accepts OPTIONS from an allowed Origin", async () => {
  const context = createHandlerTestContext();
  const request = createRequest("OPTIONS", "https://mcp.poligraph.fr");
  context.response.setHeader("Vary", "Accept-Encoding");

  await context.handler(request, context.response);

  assert.equal(context.responseState.statusCode, 204);
  assert.equal(
    context.responseState.headers.get("access-control-allow-origin"),
    "https://mcp.poligraph.fr",
  );
  assert.equal(
    context.responseState.headers.get("vary"),
    "Accept-Encoding, Origin",
  );
  assertNoMcpResourceInitialization(context, "allowed OPTIONS");
});

test("the Vercel handler rejects OPTIONS from a forbidden Origin", async () => {
  console.warn = () => {};
  const context = createHandlerTestContext();
  const request = createRequest("OPTIONS", "https://evil.example");

  await context.handler(request, context.response);

  assert.equal(context.responseState.statusCode, 403);
  assertNoMcpResourceInitialization(context, "forbidden OPTIONS");
});

test("the Vercel handler accepts OPTIONS without Origin and without ACAO", async () => {
  const context = createHandlerTestContext();
  const request = createRequest("OPTIONS");

  await context.handler(request, context.response);

  assert.equal(context.responseState.statusCode, 204);
  assert.equal(
    context.responseState.headers.get("access-control-allow-origin"),
    undefined,
  );
  assert.equal(
    [...context.responseState.headers.values()].includes("*"),
    false,
  );
  assertNoMcpResourceInitialization(context, "OPTIONS without Origin");
});

test("a rejected Origin is handled before MCP message logging", async () => {
  const messages: unknown[] = [];
  console.log = (...args: unknown[]) => {
    messages.push(args);
  };
  console.warn = () => {};
  const context = createHandlerTestContext();
  const request = createRequest("POST", "https://evil.example", {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
  });

  await context.handler(request, context.response);

  assert.deepEqual(messages, []);
  assertNoMcpResourceInitialization(context, "rejected Origin");
});

test("invalid Origin configuration makes the Vercel handler fail closed", async () => {
  process.env.MCP_ALLOWED_ORIGINS = "*";
  console.error = () => {};
  const context = createHandlerTestContext();
  const request = createRequest("OPTIONS");

  await context.handler(request, context.response);

  assert.equal(context.responseState.statusCode, 500);
  assert.deepEqual(context.responseState.body, {
    jsonrpc: "2.0",
    error: { code: -32603, message: "Internal error" },
    id: null,
  });
  assert.equal(
    context.responseState.headers.get("access-control-allow-origin"),
    undefined,
  );
  assertNoMcpResourceInitialization(context, "invalid configuration");
});

test("the nominal Vercel path uses the injected MCP factories", async () => {
  console.log = () => {};
  const context = createHandlerTestContext();
  const body = {
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
  };
  const request = createRequest("POST", undefined, body);

  await context.handler(request, context.response);

  assert.equal(context.calls.createMcpServer, 1);
  assert.equal(context.calls.createTransport, 1);
  assert.equal(context.calls.serverConnect, 1);
  assert.equal(context.calls.transportHandleRequest, 1);
  assert.equal(context.responseState.responseOnCalls.length, 1);
  assert.deepEqual(
    context.responseState.responseOnCalls.map(({ event }) => event),
    ["close"],
  );
  assert.equal(
    typeof context.responseState.responseOnCalls[0]?.listener,
    "function",
  );
  assert.strictEqual(context.serverConnectTransports[0], context.transport);
  assert.strictEqual(
    context.transportHandleRequestCalls[0]?.request,
    request,
  );
  assert.strictEqual(
    context.transportHandleRequestCalls[0]?.response,
    context.response,
  );
  assert.strictEqual(
    context.transportHandleRequestCalls[0]?.parsedBody,
    body,
  );
  assert.equal(context.calls.serverClose, 0);
  assert.equal(context.calls.transportClose, 0);
});
