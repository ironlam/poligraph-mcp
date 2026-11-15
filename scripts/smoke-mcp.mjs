import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const endpoint = process.argv[2] ?? "https://mcp.poligraph.fr/mcp";
const client = new Client({ name: "poligraph-release-smoke", version: "1.0.0" });
const checks = {
  search_politicians: { query: "Macron", limit: 2 },
  get_politician: { slug: "emmanuel-macron" },
  get_politician_relations: { slug: "emmanuel-macron", limit: 2 },
  list_affairs: { limit: 2 },
  get_politician_affairs: { slug: "nicolas-sarkozy" },
  list_votes: { limit: 5 },
  get_politician_votes: { slug: "jean-luc-melenchon", limit: 2 },
  get_vote_stats: { chamber: "AN" },
  list_mandates: { limit: 2 },
  list_parties: { limit: 2 },
  get_party: { slug: "renaissance" },
  list_factchecks: { limit: 5 },
  get_politician_factchecks: { slug: "emmanuel-macron", limit: 2 },
  get_factcheck_stats: { limit: 2 },
  list_elections: { limit: 2 },
  get_election: { slug: "presidentielle-2027" },
  get_department_stats: { filter: "all" },
  get_deputies_by_department: { department: "Seine-Saint-Denis" },
  search_advanced: { mandate: "DEPUTE", limit: 2 },
};
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  fetch: (url, options) =>
    fetch(url, {
      ...options,
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    }),
});
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(JSON.stringify({ endpoint, server: client.getServerVersion(), tools: tools.length }));
  assert.deepEqual(tools.map((t) => t.name).sort(), Object.keys(checks).sort());
  for (const tool of tools) {
    assert.ok(tool.title || tool.annotations?.title);
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, true);
  }
  const callCases = [
    ...Object.entries(checks).map(([name, args]) => ({ name, args })),
    { name: "search_advanced", args: { query: "Macron", limit: 2 }, scenario: "search by name" },
  ];
  for (const { name, args, scenario } of callCases) {
    try {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(result.content[0]?.text);
      assert.ok(result.structuredContent);
      assert.ok(result.content.some((entry) => entry.type === "text" && entry.text.trim()));
      if (scenario === "search by name") {
        assert.ok(result.structuredContent.results.some(({ slug }) => slug === "emmanuel-macron"));
      }
      console.log(
        JSON.stringify({
          name,
          scenario,
          status: "pass",
          fields: Object.keys(result.structuredContent),
        }),
      );
    } catch (error) {
      process.exitCode = 1;
      console.log(JSON.stringify({ name, scenario, status: "fail", error: error.message }));
    }
  }
} finally {
  await client.close();
}
