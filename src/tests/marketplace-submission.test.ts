import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

interface SubmissionData {
  schemaVersion: number;
  status: string;
  service: Record<string, unknown>;
  listing: Record<string, string>;
  useCases: string[];
  claude: Record<string, unknown>;
  openai: {
    packageName: string;
    version: string;
    displayName: string;
    developerName: string;
    shortDescription: string;
    longDescription: string;
    capabilities: string[];
    starterPrompts: string[];
    screenshotsRequired: boolean;
    pluginMode: string;
    demoRecording: {
      status: string;
      url: string | null;
      document: string;
      requiredBeforeSubmission: boolean;
    };
    toolAnnotationJustifications: {
      document: string;
      toolCount: number;
      status: string;
      openWorldReviewStatus: string;
    };
  };
}

interface SubmissionTestCase {
  id: string;
  prompt: string;
  expectedTools: string[];
  expectedBehavior: string[];
  editorialInvariants: string[];
  status: string;
}

interface SubmissionTestCases {
  schemaVersion: number;
  status: string;
  positive: SubmissionTestCase[];
  negative: SubmissionTestCase[];
}

interface ToolHintJustification {
  value: boolean;
  justification: string;
}

interface ToolAnnotationJustification {
  name: string;
  readOnlyHint: ToolHintJustification;
  destructiveHint: ToolHintJustification;
  openWorldHint: ToolHintJustification;
}

interface ToolAnnotationJustifications {
  schemaVersion: number;
  status: string;
  openWorldReviewStatus: string;
  runtimeAnnotationsChanged: boolean;
  tools: ToolAnnotationJustification[];
}

const rootFile = (...parts: string[]) => join(process.cwd(), ...parts);
const readUtf8 = (...parts: string[]) =>
  readFileSync(rootFile(...parts), "utf8");
const readJson = <T>(...parts: string[]): T =>
  JSON.parse(readUtf8(...parts)) as T;

const submission = readJson<SubmissionData>(
  "docs",
  "marketplace",
  "submission-data.json",
);
const cases = readJson<SubmissionTestCases>(
  "docs",
  "marketplace",
  "test-cases.json",
);
const toolJustifications = readJson<ToolAnnotationJustifications>(
  "docs",
  "marketplace",
  "openai-tool-justifications.json",
);

const EXPECTED_TOOLS = new Set([
  "search_politicians",
  "get_politician",
  "get_politician_relations",
  "list_affairs",
  "get_politician_affairs",
  "list_votes",
  "get_politician_votes",
  "get_vote_stats",
  "list_mandates",
  "list_parties",
  "get_party",
  "list_factchecks",
  "get_politician_factchecks",
  "get_factcheck_stats",
  "list_elections",
  "get_election",
  "get_department_stats",
  "get_deputies_by_department",
  "search_advanced",
]);

const EXPECTED_READ_OPERATIONS: Readonly<Record<string, RegExp>> = {
  search_politicians: /Recherche des personnalités politiques publiées/u,
  get_politician: /Consulte la fiche publiée d’une personnalité/u,
  get_politician_relations: /Consulte les relations documentées/u,
  list_affairs: /Liste les affaires judiciaires publiées/u,
  get_politician_affairs: /Consulte les affaires publiées/u,
  list_votes: /Liste les scrutins parlementaires publiés/u,
  get_politician_votes: /Consulte les votes publiés/u,
  get_vote_stats: /Calcule un agrégat de scrutins et de votes/u,
  list_mandates: /Liste les mandats politiques publiés/u,
  list_parties: /Liste les partis politiques publiés/u,
  get_party: /Consulte la fiche publiée d’un parti politique/u,
  list_factchecks: /Liste les fact-checks publiés/u,
  get_politician_factchecks: /Consulte les fact-checks publiés/u,
  get_factcheck_stats: /Calcule un agrégat du corpus de fact-checks/u,
  list_elections: /Liste les élections publiées/u,
  get_election: /Consulte le détail publié d’une élection/u,
  get_department_stats: /Calcule un agrégat de représentation départementale/u,
  get_deputies_by_department: /Liste les députés publiés d’un département/u,
  search_advanced: /Recherche dans le corpus public combiné/u,
};

const MARKETPLACE_MARKDOWN = [
  "README.md",
  "CLAUDE_SUBMISSION.md",
  "OPENAI_SUBMISSION.md",
  "OPENAI_DEMO_RECORDING.md",
  "TEST_CASES.md",
  "POLICY_BOUNDARIES.md",
  join("assets", "README.md"),
] as const;

test("submission data keeps the draft service identity and read-only contract", () => {
  assert.equal(submission.schemaVersion, 1);
  assert.equal(submission.status, "DRAFT_NOT_READY_FOR_SUBMISSION");
  assert.equal(submission.service.publisher, "Association Sankofa");
  assert.equal(submission.service.publisherRegistry, "RNA W931031256");
  assert.equal(submission.service.publisherEmail, "contact@poligraph.fr");
  assert.equal(submission.service.mcpUrl, "https://mcp.poligraph.fr/mcp");
  assert.equal(submission.service.transport, "streamable-http");
  assert.equal(submission.service.authentication, "none");
  assert.equal(submission.service.embeddedUi, false);
  assert.equal(submission.service.toolCount, 19);
  assert.equal(submission.service.readOnly, true);
  assert.equal(submission.service.writesExternalSystems, false);
});

test("submission data uses the exact public URLs", () => {
  assert.equal(submission.service.websiteUrl, "https://mcp.poligraph.fr/");
  assert.equal(submission.service.mcpUrl, "https://mcp.poligraph.fr/mcp");
  assert.equal(
    submission.service.privacyUrl,
    "https://poligraph.fr/confidentialite",
  );
  assert.equal(
    submission.service.termsUrl,
    "https://poligraph.fr/conditions-utilisation",
  );
  assert.equal(submission.service.supportUrl, "https://poligraph.fr/support");
  assert.equal(
    submission.service.legalUrl,
    "https://poligraph.fr/mentions-legales",
  );
});

test("Claude listing limits and neutral use cases are enforced", () => {
  const serverName = submission.claude.serverName;
  const tagline = submission.claude.tagline;
  const description = submission.claude.description;

  assert.ok(typeof serverName === "string");
  assert.ok(serverName.length > 0 && serverName.length <= 100);
  assert.ok(typeof tagline === "string");
  assert.ok(tagline.length > 0 && tagline.length <= 55);
  assert.ok(typeof description === "string");
  assert.ok(description.length > 0 && description.length <= 2_000);
  assert.ok(
    submission.useCases.length >= 3 && submission.useCases.length <= 5,
  );

  const useCases = submission.useCases.join("\n");
  assert.doesNotMatch(
    useCases,
    /campagne|ciblage|persuasion|profilage d[’']électeurs?/iu,
  );
});

test("OpenAI metadata and starter prompts respect final submission limits", () => {
  const openai = submission.openai;

  assert.equal(openai.packageName, "poligraph-mcp");
  assert.equal(openai.version, "2.0.0");
  assert.equal(openai.displayName, "PoliGraph");
  assert.doesNotMatch(openai.displayName, /[\r\n]/u);
  assert.ok(openai.displayName.length <= 30);
  assert.equal(openai.developerName, "Association Sankofa");
  assert.doesNotMatch(openai.developerName, /[\r\n]/u);
  assert.ok(openai.developerName.length <= 80);
  assert.equal(openai.shortDescription, "Données politiques sourcées");
  assert.doesNotMatch(openai.shortDescription, /[\r\n]/u);
  assert.ok(openai.shortDescription.length <= 30);
  assert.ok(
    openai.longDescription.length > 0 &&
      openai.longDescription.length <= 4_000,
  );

  assert.equal(openai.capabilities.length, 6);
  assert.ok(openai.capabilities.length <= 20);
  for (const capability of openai.capabilities) {
    assert.equal(capability, capability.trim());
    assert.ok(capability.length > 0 && capability.length <= 120);
    assert.doesNotMatch(capability, /[\r\n]/u);
  }

  assert.equal(
    Object.prototype.hasOwnProperty.call(submission, "starterPrompts"),
    false,
    "starter prompts must only exist in the OpenAI section",
  );
  assert.equal(openai.starterPrompts.length, 3);
  const normalizedPrompts = openai.starterPrompts.map((prompt) =>
    prompt.trim().replace(/\s+/gu, " "),
  );
  assert.equal(new Set(normalizedPrompts).size, normalizedPrompts.length);

  for (const [index, prompt] of openai.starterPrompts.entries()) {
    assert.equal(prompt, normalizedPrompts[index]);
    assert.ok(prompt.length > 0 && prompt.length <= 128);
    assert.doesNotMatch(prompt, /[\r\n@]/u);
  }
});

test("structured test cases keep the full positive and negative matrix", () => {
  assert.equal(cases.schemaVersion, 1);
  assert.equal(cases.status, "DRAFT_NOT_EXECUTED_IN_PLATFORM_PORTALS");
  assert.equal(cases.positive.length, 5);
  assert.equal(cases.negative.length, 3);

  const allCases = [...cases.positive, ...cases.negative];
  const ids = allCases.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, "test case IDs must be unique");

  for (const testCase of cases.positive) {
    assert.ok(
      testCase.expectedTools.length > 0,
      `${testCase.id} must name at least one expected tool`,
    );
    for (const toolName of testCase.expectedTools) {
      assert.ok(
        EXPECTED_TOOLS.has(toolName),
        `${testCase.id} references unknown tool ${toolName}`,
      );
    }
  }

  for (const testCase of cases.negative) {
    assert.deepEqual(
      testCase.expectedTools,
      [],
      `${testCase.id} must not invoke a tool`,
    );
  }

  assert.ok(
    allCases.every(
      ({ status }) => status === "NOT_EXECUTED_IN_OFFICIAL_PORTAL",
    ),
  );
  const encodedCases = JSON.stringify(cases);
  for (const boundary of [
    /lecture seule/iu,
    /ciblage politique/iu,
    /profil(?:age|er).+électeurs/iu,
    /culpabilit/iu,
    /mention.+déclarant/iu,
    /classement normatif/iu,
  ]) {
    assert.match(encodedCases, boundary);
  }

  for (const forbiddenResultKey of [
    "expectedResult",
    "expectedOutput",
    "expectedValues",
  ]) {
    assert.ok(
      !encodedCases.includes(`"${forbiddenResultKey}"`),
      `${forbiddenResultKey} must not freeze a live result`,
    );
  }
});

test("marketplace documents contain no placeholders or approval claims", () => {
  const markdown = MARKETPLACE_MARKDOWN.map((path) =>
    readUtf8("docs", "marketplace", path),
  ).join("\n");
  const publicFields = JSON.stringify({ submission, toolJustifications });
  const prohibited = [
    /\bTODO\b/u,
    /\bTBD\b/u,
    /À compléter/iu,
    /example\.com/iu,
    /support@example\.com/iu,
    /OpenAI approved/iu,
    /Claude approved/iu,
    /Anthropic approved/iu,
    /certified by/iu,
    /official partner/iu,
    /recommended by OpenAI/iu,
    /recommended by Anthropic/iu,
    /\b(?:approuv|valid|certifi|recommand)é(?:e|s|es)?\s+par\s+(?:OpenAI|Anthropic|Claude)\b/iu,
    /\b(?:approbation|validation|certification|recommandation)\s+(?:de|d[’']|par)\s*(?:OpenAI|Anthropic|Claude)\b/iu,
    /\b(?:OpenAI|Anthropic|Claude)\s+(?:(?:a|ont)\s+)?(?:approuv|valid|certifi|recommand)(?:e|é(?:e|s|es)?)(?=\s|[.,;:!?]|$)/iu,
    /\b(?:partenaire(?:\s+officiel(?:le)?)?|partenariat(?:\s+officiel)?)\s+(?:(?:de|avec)\s+|d[’'])?(?:OpenAI|Anthropic|Claude)\b/iu,
    /aucune vidéo (?:n’est )?requise/iu,
  ];

  for (const frenchApprovalClaim of [
    "PoliGraph est approuvé par OpenAI",
    "PoliGraph est validé par Anthropic",
    "PoliGraph est certifié par Claude",
    "PoliGraph est recommandé par OpenAI",
    "Anthropic a approuvé PoliGraph",
    "PoliGraph est partenaire officiel d’Anthropic",
    "PoliGraph annonce un partenariat avec Claude",
  ]) {
    assert.ok(
      prohibited.some((pattern) => pattern.test(frenchApprovalClaim)),
      `French approval claim must be rejected: ${frenchApprovalClaim}`,
    );
  }

  for (const pattern of prohibited) {
    assert.doesNotMatch(markdown, pattern);
    assert.doesNotMatch(publicFields, pattern);
  }
});

test("the marketplace PNG is a 512 pixel transparent export of the unchanged logo", () => {
  const png = readFileSync(
    rootFile("docs", "marketplace", "assets", "poligraph-icon-512.png"),
  );
  const logo = readFileSync(rootFile("public", "logo.svg"));

  assert.equal(
    createHash("sha256").update(png).digest("hex"),
    "07ac3e69b2c1ce91ddec21223b19f4129d6068e176d6d435402c1e85519cda35",
    "marketplace PNG must match the validated 512 pixel export",
  );
  assert.ok(png.length > 1_024);
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.ok(
    png[25] === 4 || png[25] === 6,
    "PNG color type must include an alpha channel",
  );
  assert.doesNotMatch(png.subarray(0, 200).toString("utf8"), /git-lfs/iu);
  assert.equal(
    createHash("sha256").update(logo).digest("hex"),
    "75d75fdc80476a0d7de66658ea28f14e9c4e980f635e2298ca8311c00b980aeb",
    "public/logo.svg must remain unchanged",
  );
});

test("portal documents stay draft and distinguish OpenAI publication paths", () => {
  const claude = readUtf8("docs", "marketplace", "CLAUDE_SUBMISSION.md");
  const openai = readUtf8("docs", "marketplace", "OPENAI_SUBMISSION.md");
  const demo = readUtf8(
    "docs",
    "marketplace",
    "OPENAI_DEMO_RECORDING.md",
  );
  const testCases = readUtf8("docs", "marketplace", "TEST_CASES.md");
  const boundaries = readUtf8(
    "docs",
    "marketplace",
    "POLICY_BOUNDARIES.md",
  );

  for (const document of [claude, openai, demo, testCases, boundaries]) {
    assert.ok(document.startsWith("DRAFT — NOT READY FOR SUBMISSION"));
  }

  assert.match(openai, /Plugins Directory/);
  assert.match(openai, /GPT Store.+parcours distinct/su);
  assert.match(openai, /résidence globale/iu);
  assert.match(openai, /Captures requises.+non/iu);
  assert.match(openai, /Enregistrement de démonstration.+requis/su);
  assert.match(openai, /non exécutées/iu);
  assert.equal(submission.openai.screenshotsRequired, false);
  assert.equal(submission.openai.pluginMode, "mcp_only");

  assert.equal(submission.openai.demoRecording.requiredBeforeSubmission, true);
  assert.equal(
    submission.openai.demoRecording.status,
    "NEEDS_HUMAN_RECORDING_AND_HTTPS_URL",
  );
  assert.equal(submission.openai.demoRecording.url, null);
  assert.match(demo, /URL HTTPS.+avant la soumission/su);
  assert.match(demo, /public\/poligraph-chatgpt\.mp4.+pointeur Git LFS/su);
  assert.match(demo, /ne constitue\s+pas l’enregistrement de soumission/u);
  assert.doesNotMatch(
    demo,
    /https?:\/\//u,
    "demo must not contain a placeholder URL",
  );
});

test("all 19 OpenAI tool annotation justifications are complete and draft", () => {
  assert.equal(toolJustifications.schemaVersion, 1);
  assert.equal(
    toolJustifications.status,
    "DRAFT_NOT_SCANNED_IN_OPENAI_PORTAL",
  );
  assert.equal(
    toolJustifications.openWorldReviewStatus,
    "NEEDS_SCAN_TOOLS_CONFIRMATION",
  );
  assert.equal(toolJustifications.runtimeAnnotationsChanged, false);
  assert.equal(toolJustifications.tools.length, 19);

  const names = toolJustifications.tools.map(({ name }) => name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual([...names].sort(), [...EXPECTED_TOOLS].sort());

  for (const tool of toolJustifications.tools) {
    assert.deepEqual(
      Object.keys(tool).sort(),
      ["destructiveHint", "name", "openWorldHint", "readOnlyHint"],
    );
    assert.equal(tool.readOnlyHint.value, true);
    assert.equal(tool.destructiveHint.value, false);
    assert.equal(tool.openWorldHint.value, true);

    for (const hint of [
      tool.readOnlyHint,
      tool.destructiveHint,
      tool.openWorldHint,
    ]) {
      assert.deepEqual(Object.keys(hint).sort(), ["justification", "value"]);
      assert.ok(hint.justification.trim().length > 0);
    }

    const expectedOperation = EXPECTED_READ_OPERATIONS[tool.name];
    assert.ok(expectedOperation, `${tool.name} must have an operation check`);
    assert.match(tool.readOnlyHint.justification, expectedOperation);
    assert.match(tool.readOnlyHint.justification, /API publique PoliGraph/u);
    assert.match(
      tool.readOnlyHint.justification,
      /ne crée, ne modifie et ne supprime aucune donnée/u,
    );
    assert.match(tool.readOnlyHint.justification, /aucune action externe/u);
    assert.match(
      tool.destructiveHint.justification,
      /aucune suppression, aucun écrasement/u,
    );
    assert.match(
      tool.destructiveHint.justification,
      /n’envoie aucun message/u,
    );
    assert.match(tool.destructiveHint.justification, /aucune transaction/u);
    assert.match(
      tool.destructiveHint.justification,
      /aucun job ou workflow/u,
    );
    assert.match(
      tool.destructiveHint.justification,
      /aucune action irréversible/u,
    );
    assert.match(
      tool.openWorldHint.justification,
      /extérieure au processus MCP/u,
    );
    assert.match(
      tool.openWorldHint.justification,
      /sources publiques|données publiques/u,
    );
    assert.match(
      tool.openWorldHint.justification,
      /ne publie, n’envoie et ne modifie aucun état public/u,
    );
    assert.match(
      tool.openWorldHint.justification,
      /readOnlyHint et destructiveHint/u,
    );
  }

  assert.equal(
    submission.openai.toolAnnotationJustifications.toolCount,
    19,
  );
  assert.equal(
    submission.openai.toolAnnotationJustifications.status,
    toolJustifications.status,
  );
  assert.equal(
    submission.openai.toolAnnotationJustifications.openWorldReviewStatus,
    toolJustifications.openWorldReviewStatus,
  );
});
