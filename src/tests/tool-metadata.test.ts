import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";

const EXPECTED_TITLES: Readonly<Record<string, string>> = Object.freeze({
  search_politicians: "Rechercher des personnalités politiques",
  get_politician: "Consulter une personnalité politique",
  get_politician_relations: "Consulter les relations d’une personnalité",
  list_affairs: "Lister les affaires judiciaires",
  get_politician_affairs: "Consulter les affaires d’une personnalité",
  list_votes: "Lister les scrutins parlementaires",
  get_politician_votes: "Consulter les votes d’un parlementaire",
  get_vote_stats: "Consulter les statistiques de vote",
  list_mandates: "Lister les mandats",
  list_parties: "Lister les partis politiques",
  get_party: "Consulter un parti politique",
  list_factchecks: "Lister les fact-checks",
  get_politician_factchecks:
    "Consulter les fact-checks d’une personnalité",
  get_factcheck_stats: "Consulter les statistiques des fact-checks",
  list_elections: "Lister les élections",
  get_election: "Consulter une élection",
  get_department_stats: "Consulter les statistiques d’un département",
  get_deputies_by_department: "Lister les députés d’un département",
  search_advanced: "Rechercher dans le corpus PoliGraph",
});

test("les 19 tools exposent des métadonnées marketplace conformes", async () => {
  const server = createServer();
  const client = new Client({
    name: "poligraph-tool-metadata-test",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    const expectedNames = Object.keys(EXPECTED_TITLES);

    assert.equal(tools.length, 19, "le serveur doit exposer exactement 19 tools");
    assert.equal(
      new Set(names).size,
      names.length,
      "les noms techniques doivent être uniques",
    );
    assert.deepEqual(
      [...names].sort(),
      [...expectedNames].sort(),
      "la liste des tools doit correspondre exactement au mapping attendu",
    );

    for (const tool of tools) {
      const description = tool.description;
      const annotations = tool.annotations;

      assert.ok(
        tool.name.length <= 64,
        `${tool.name}: le nom technique dépasse 64 caractères`,
      );
      assert.ok(
        typeof description === "string" && description.trim().length > 0,
        `${tool.name}: description absente ou vide`,
      );
      assert.ok(annotations, `${tool.name}: annotations absentes`);
      assert.equal(
        annotations.title,
        EXPECTED_TITLES[tool.name],
        `${tool.name}: title incorrect`,
      );
      assert.ok(
        annotations.title?.trim().length,
        `${tool.name}: title vide`,
      );
      assert.equal(
        annotations.readOnlyHint,
        true,
        `${tool.name}: le tool doit être en lecture seule`,
      );
      assert.equal(
        annotations.destructiveHint,
        false,
        `${tool.name}: le tool ne doit pas être destructif`,
      );
      assert.equal(
        annotations.openWorldHint,
        true,
        `${tool.name}: le tool atteint l’API publique PoliGraph extérieure au processus MCP`,
      );
    }
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});
