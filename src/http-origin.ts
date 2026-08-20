export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  "https://mcp.poligraph.fr",
  "https://poligraph-mcp.vercel.app",
]);

export const CORS_ALLOW_METHODS = "POST, GET, DELETE, OPTIONS";
export const CORS_ALLOW_HEADERS =
  "Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID";
export const CORS_EXPOSE_HEADERS = "Mcp-Session-Id";

const MAX_ORIGIN_LENGTH = 2048;
const MAX_LOG_ORIGIN_LENGTH = 200;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const EXACT_ORIGIN_PATTERN = /^(https?):\/\/[^/?#]+$/i;

export class OriginConfigurationError extends Error {
  constructor() {
    super("Invalid MCP_ALLOWED_ORIGINS configuration");
    this.name = "OriginConfigurationError";
  }
}

export type OriginRejectionReason =
  | "MULTIPLE_ORIGIN_VALUES"
  | "INVALID_ORIGIN"
  | "NULL_ORIGIN"
  | "ORIGIN_NOT_ALLOWED";

export type OriginDecision =
  | { decision: "ALLOW_WITHOUT_ORIGIN" }
  | { decision: "ALLOW_WITH_ORIGIN"; origin: string }
  | {
      decision: "REJECT";
      reason: OriginRejectionReason;
      normalizedOrigin?: string;
    };

export function normalizeOrigin(value: string): string | undefined {
  const candidate = value.trim();

  if (
    candidate.length === 0 ||
    candidate.length > MAX_ORIGIN_LENGTH ||
    candidate === "null" ||
    candidate.includes(",") ||
    candidate.includes("\\") ||
    !EXACT_ORIGIN_PATTERN.test(candidate)
  ) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }

  if (
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return undefined;
  }

  if (url.protocol === "https:") {
    return url.origin;
  }

  if (
    url.protocol === "http:" &&
    LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return url.origin;
  }

  return undefined;
}

export function buildAllowedOrigins(
  configuredOrigins: string | undefined,
  additionalOrigins: readonly string[] = [],
): ReadonlySet<string> {
  const allowedOrigins = new Set<string>();

  const addConfiguredOrigin = (value: string): void => {
    const normalized = normalizeOrigin(value);
    if (normalized === undefined) {
      throw new OriginConfigurationError();
    }
    allowedOrigins.add(normalized);
  };

  for (const origin of DEFAULT_ALLOWED_ORIGINS) {
    addConfiguredOrigin(origin);
  }

  for (const origin of additionalOrigins) {
    addConfiguredOrigin(origin);
  }

  if (configuredOrigins !== undefined) {
    for (const origin of configuredOrigins.split(",")) {
      const trimmed = origin.trim();
      if (trimmed !== "") {
        addConfiguredOrigin(trimmed);
      }
    }
  }

  return allowedOrigins;
}

export function evaluateOriginHeader(
  header: string | string[] | undefined,
  allowedOrigins: ReadonlySet<string>,
): OriginDecision {
  if (header === undefined) {
    return { decision: "ALLOW_WITHOUT_ORIGIN" };
  }

  if (Array.isArray(header)) {
    if (header.length !== 1) {
      return { decision: "REJECT", reason: "MULTIPLE_ORIGIN_VALUES" };
    }
    return evaluateOriginHeader(header[0], allowedOrigins);
  }

  if (header.includes(",")) {
    return { decision: "REJECT", reason: "MULTIPLE_ORIGIN_VALUES" };
  }

  if (header.trim() === "null") {
    return { decision: "REJECT", reason: "NULL_ORIGIN" };
  }

  const normalizedOrigin = normalizeOrigin(header);
  if (normalizedOrigin === undefined) {
    return { decision: "REJECT", reason: "INVALID_ORIGIN" };
  }

  if (!allowedOrigins.has(normalizedOrigin)) {
    return {
      decision: "REJECT",
      reason: "ORIGIN_NOT_ALLOWED",
      normalizedOrigin,
    };
  }

  return { decision: "ALLOW_WITH_ORIGIN", origin: normalizedOrigin };
}

export function getCorsHeaders(
  decision: Exclude<OriginDecision, { decision: "REJECT" }>,
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Expose-Headers": CORS_EXPOSE_HEADERS,
  };

  if (decision.decision === "ALLOW_WITH_ORIGIN") {
    headers["Access-Control-Allow-Origin"] = decision.origin;
  }

  return headers;
}

export function appendOriginToVary(
  currentValue: string | string[] | number | undefined,
): string {
  const values = (Array.isArray(currentValue)
    ? currentValue
    : currentValue === undefined
      ? []
      : [String(currentValue)]
  )
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value !== "");

  if (!values.some((value) => value.toLowerCase() === "origin")) {
    values.push("Origin");
  }

  return values.join(", ");
}

export function getOriginLogValue(decision: OriginDecision): string {
  if (decision.decision === "ALLOW_WITH_ORIGIN") {
    return decision.origin.slice(0, MAX_LOG_ORIGIN_LENGTH);
  }

  if (
    decision.decision === "REJECT" &&
    decision.normalizedOrigin !== undefined
  ) {
    return decision.normalizedOrigin.slice(0, MAX_LOG_ORIGIN_LENGTH);
  }

  return "<invalid>";
}
