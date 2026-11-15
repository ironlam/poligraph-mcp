import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

test("judicial tools preserve roles, sources, and the public boolean appeal flag", async (t) => {
  const semantics = {
    involvementLabel: "Mise en cause",
    statusLabel: "Condamnation en première instance",
    statusDescription: "Procédure en cours",
    categoryLabel: "Autre",
    statusAppliesToPolitician: true,
    needsPresumption: true,
    certaintyLevel: "EN_COURS",
    certaintyLabel: "En cours",
    judicialMaturity: "ENQUETE",
    judicialMaturityLabel: "Enquête",
  };
  const politician = { slug: "personne-fictive", fullName: "Personne fictive" };
  const direct = {
    slug: "affaire-fictive",
    title: "Affaire fictive",
    status: "CONDAMNATION_PREMIERE_INSTANCE",
    category: "AUTRE",
    involvement: "DIRECT",
    semantics,
    appeal: true,
    sentence: "Peine fictive",
    sources: [{ url: "https://example.org/source", title: "Source fictive", publisher: "Source" }],
    politician,
  };
  const cases = [
    direct,
    { ...direct, status: "SIGNALEMENT_PARQUET", appeal: false, sentence: null },
    {
      ...direct,
      involvement: "VICTIM",
      semantics: { ...semantics, statusAppliesToPolitician: false, needsPresumption: false },
    },
    { ...direct, semantics: null },
  ];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("involvement"), "DIRECT,VICTIM");
    return Response.json(
      url.pathname === "/api/affaires"
        ? { data: cases, pagination: { page: 1, total: cases.length, totalPages: 1 } }
        : { politician, affairs: cases, total: cases.length },
    );
  });

  const client = new Client({ name: "affair-tools-test", version: "1.0.0" });
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    for (const name of ["list_affairs", "get_politician_affairs"]) {
      const result = await client.callTool({
        name,
        arguments: {
          involvement: "DIRECT,VICTIM",
          ...(name === "get_politician_affairs" ? { slug: politician.slug } : {}),
        },
      });
      assert.equal(result.isError, undefined);
      const structured = result.structuredContent as { items?: unknown[]; affairs?: unknown[] };
      const items = (structured.items ?? structured.affairs) as {
        appeal: boolean | null;
        sentence: string | null;
        statusCode: string | null;
        sources: { url: string }[];
      }[];
      assert.deepEqual(
        items.map(({ appeal }) => appeal),
        [true, null, null, null],
      );
      assert.equal(items[2].sentence, null);
      assert.equal(items[3].sentence, null);
      assert.equal(items[0].sources[0].url, direct.sources[0].url);
      assert.equal(items[1].statusCode, "SIGNALEMENT_PARQUET");
      assert.match(JSON.stringify(result.content), /présomption d'innocence/iu);
    }

    cases.push({ ...direct, involvement: "PLAINTIFF" });
    const mismatch = await client.callTool({
      name: "list_affairs",
      arguments: { involvement: "DIRECT,VICTIM" },
    });
    assert.equal(mismatch.isError, true);
    assert.match(JSON.stringify(mismatch.content), /pas appliqué le filtre involvement/u);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});
