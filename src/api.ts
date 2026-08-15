const BASE_URL = "https://poligraph.fr";
const BASE_ORIGIN = new URL(BASE_URL).origin;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;

/**
 * Format an ISO date string to a readable French date (ex: "21 décembre 1977").
 * Returns "—" for null/undefined/empty values.
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readBoundedBody(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError(502, "Réponse amont trop volumineuse");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function safeUpstreamError(status: number): ApiError {
  // Upstream error bodies are untrusted data. Never reflect them into a model-visible
  // error message, even when they contain JSON with an `error` field.
  return new ApiError(status, `API ${status}: Erreur de l'API publique Poligraph`);
}

export async function fetchAPI<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(path, BASE_URL);

  if (url.origin !== BASE_ORIGIN) {
    throw new ApiError(400, "Chemin API Poligraph invalide");
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "poligraph-mcp/2.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ApiError(504, "Délai dépassé pour l'API publique Poligraph");
    }
    throw new ApiError(502, "API publique Poligraph indisponible");
  }

  const body = await readBoundedBody(response);

  if (!response.ok) {
    throw safeUpstreamError(response.status);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError(502, "Réponse JSON invalide de l'API publique Poligraph");
  }
}
