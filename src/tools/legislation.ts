import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI } from "../api.js";

interface SearchResult {
  id: string;
  slug: string;
  fullName: string;
  photoUrl: string | null;
  currentParty: {
    shortName: string;
    color: string;
  } | null;
  currentMandate: {
    type: string;
    constituency: string | null;
  } | null;
  /** Legacy published-affair total across every role. */
  affairsCount: number;
}

interface AdvancedSearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

export function registerLegislationTools(server: McpServer): void {
  server.registerTool(
    "search_advanced",
    {
      description:
        "Recherche avancée sur les personnalités politiques publiées. Le filtre hasAffairs signifie seulement l'existence d'une affaire publiée, tous rôles confondus ; le résultat n'affiche jamais ce total comme un indicateur à charge.",
      inputSchema: {
        query: z
          .string()
          .max(200)
          .optional()
          .describe("Recherche par nom ou prénom (min 2 caractères)"),
        party: z.string().max(100).optional().describe("Filtrer par ID de parti"),
        mandate: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Code de type de mandat accepté par l'API publique"),
        department: z
          .string()
          .max(100)
          .optional()
          .describe("Filtrer par département (ex: 'Paris', 'Bouches-du-Rhône')"),
        hasAffairs: z
          .boolean()
          .optional()
          .describe(
            "Filtrer sur l'existence d'au moins une affaire publiée, tous rôles confondus",
          ),
        isActive: z
          .boolean()
          .optional()
          .describe("Filtrer les politiciens ayant un mandat actuel"),
        page: z.number().int().min(1).default(1).describe("Numéro de page"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Résultats par page (max 100)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Recherche avancée en cours...",
        "openai/toolInvocation/invoked": "Résultats trouvés",
      },
    },
    async ({ query, party, mandate, department, hasAffairs, isActive, page, limit }) => {
      const data = await fetchAPI<AdvancedSearchResponse>("/api/search/advanced", {
        q: query,
        party,
        mandate,
        department,
        hasAffairs: hasAffairs !== undefined ? hasAffairs : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(`**${data.total} résultats** (page ${data.page}/${data.totalPages})`);
      lines.push("");

      for (const result of data.results) {
        const partyLabel = result.currentParty
          ? ` (${result.currentParty.shortName})`
          : "";
        const mandateLabel = result.currentMandate
          ? ` — mandat actuel${result.currentMandate.constituency ? `, ${result.currentMandate.constituency}` : ""}`
          : "";
        lines.push(`- **${result.fullName}**${partyLabel}${mandateLabel}`);
        lines.push(`  /politiques/${result.slug}`);
      }

      if (data.suggestions && data.suggestions.length > 0) {
        lines.push("");
        lines.push("**Suggestions** : " + data.suggestions.join(", "));
      }

      if (data.page < data.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          total: data.total,
          page: data.page,
          totalPages: data.totalPages,
          results: data.results.map((result) => ({
            slug: result.slug,
            fullName: result.fullName,
            party: result.currentParty
              ? { shortName: result.currentParty.shortName }
              : null,
            mandate: result.currentMandate
              ? {
                  type: result.currentMandate.type,
                  constituency: result.currentMandate.constituency,
                }
              : null,
            legacyPublishedAffairsCountAllRoles: result.affairsCount,
            url: `https://poligraph.fr/politiques/${result.slug}`,
          })),
          suggestions: data.suggestions ?? [],
        },
      };
    },
  );
}
