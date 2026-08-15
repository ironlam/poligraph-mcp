import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";
import { knownEnumCode, participationLine } from "../editorial.js";

interface ScrutinListItem {
  id: string;
  externalId: string;
  title: string;
  votingDate: string;
  legislature: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: string;
  sourceUrl: string;
  totalVotes: number;
}

interface VoteListResponse {
  data: ScrutinListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface PartyStats {
  partyId: string;
  partyName: string;
  partyShortName: string;
  partyColor: string | null;
  partySlug: string | null;
  totalVotes: number;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  absentVoteRows?: number;
  cohesionRate: number;
  participationRate: number | null;
  participationStatus?: string;
}

interface DivisiveScrutin {
  id: string;
  slug: string | null;
  title: string;
  votingDate: string;
  chamber: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  divisionScore: number;
}

interface VoteStatsResponse {
  parties: PartyStats[];
  divisiveScrutins: DivisiveScrutin[];
  global: {
    totalScrutins: number;
    totalVotes: number;
    totalVotesFor: number;
    totalVotesAgainst: number;
    totalVotesAbstain: number;
    participationRate: number | null;
    participationStatus?: string;
    adoptes: number;
    rejetes: number;
  };
}

interface PoliticianVotesResponse {
  politician: {
    id: string;
    slug: string;
    fullName: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    party: {
      shortName: string;
      name: string;
      color: string;
    } | null;
  };
  stats: {
    total: number;
    pour: number;
    contre: number;
    abstention: number;
    nonVotant: number;
    eligibleScrutins?: number | null;
    scrutinsSansVoteEnregistre?: number | null;
    participationRate: number | null;
    participationStatus?: string;
  };
  votes: Array<{
    id: string;
    position: string;
    scrutin: {
      id: string;
      externalId: string;
      title: string;
      votingDate: string;
      legislature: number;
      votesFor: number;
      votesAgainst: number;
      votesAbstain: number;
      result: string;
      sourceUrl: string;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const VOTE_RESULTS = ["ADOPTED", "REJECTED"] as const;
const VOTE_POSITIONS = [
  "POUR",
  "CONTRE",
  "ABSTENTION",
  "NON_VOTANT",
  "ABSENT",
] as const;

function formatResult(result: string): string {
  switch (result) {
    case "ADOPTED":
      return "Adopté";
    case "REJECTED":
      return "Rejeté";
    default:
      return "Résultat non disponible";
  }
}

function formatPosition(position: string): string {
  switch (position) {
    case "POUR":
      return "Pour";
    case "CONTRE":
      return "Contre";
    case "ABSTENTION":
      return "Abstention";
    case "NON_VOTANT":
      return "Non-votant";
    case "ABSENT":
      return "Absent";
    default:
      return "Position non disponible";
  }
}

export function registerVoteTools(server: McpServer): void {
  server.registerTool(
    "list_votes",
    {
      description:
        "Lister les scrutins parlementaires (Assemblée nationale et Sénat) avec filtres. Un résultat inconnu reste inconnu et n'est jamais assimilé à un rejet.",
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe("Recherche dans le titre du scrutin"),
        result: z
          .enum(["ADOPTED", "REJECTED"])
          .optional()
          .describe("Filtrer par résultat : ADOPTED ou REJECTED"),
        legislature: z
          .number()
          .int()
          .optional()
          .describe("Filtrer par législature lorsque ce champ est applicable"),
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
        "openai/toolInvocation/invoking": "Recherche de scrutins...",
        "openai/toolInvocation/invoked": "Scrutins trouvés",
      },
    },
    async ({ search, result, legislature, page, limit }) => {
      const data = await fetchAPI<VoteListResponse>("/api/votes", {
        search,
        result,
        legislature,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(
        `**${data.pagination.total} scrutins** (page ${data.pagination.page}/${data.pagination.totalPages})`,
      );
      lines.push("");

      for (const scrutin of data.data) {
        lines.push(
          `- **${scrutin.title}** (${formatDate(scrutin.votingDate)})`,
        );
        lines.push(
          `  ${formatResult(scrutin.result)} — Pour: ${scrutin.votesFor}, Contre: ${scrutin.votesAgainst}, Abstention: ${scrutin.votesAbstain}`,
        );
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          total: data.pagination.total,
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          items: data.data.map((scrutin) => ({
            title: scrutin.title,
            votingDate: scrutin.votingDate,
            legislature: scrutin.legislature,
            result: knownEnumCode(scrutin.result, VOTE_RESULTS),
            votesFor: scrutin.votesFor,
            votesAgainst: scrutin.votesAgainst,
            votesAbstain: scrutin.votesAbstain,
            sourceUrl: scrutin.sourceUrl,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_politician_votes",
    {
      description:
        "Obtenir les votes enregistrés d'un politicien et les statistiques publiables. Un taux absent ou non publiable n'est jamais converti en 0 %.",
      inputSchema: {
        slug: z
          .string()
          .describe("Identifiant du politicien (ex: 'jean-luc-melenchon')"),
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
        "openai/toolInvocation/invoking": "Chargement des votes...",
        "openai/toolInvocation/invoked": "Votes chargés",
      },
    },
    async ({ slug, page, limit }) => {
      const data = await fetchAPI<PoliticianVotesResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/votes`,
        { page, limit },
      );

      const lines: string[] = [];
      const party = data.politician.party
        ? ` (${data.politician.party.name})`
        : "";
      lines.push(`# Votes — ${data.politician.fullName}${party}`);
      lines.push("");

      const stats = data.stats;
      lines.push("## Votes enregistrés");
      lines.push(`- **Total** : ${stats.total}`);
      lines.push(`- **Pour** : ${stats.pour}`);
      lines.push(`- **Contre** : ${stats.contre}`);
      lines.push(`- **Abstention** : ${stats.abstention}`);
      lines.push(`- **Non-votant** : ${stats.nonVotant}`);
      lines.push(`- ${participationLine(stats)}`);
      if (
        stats.scrutinsSansVoteEnregistre !== null &&
        stats.scrutinsSansVoteEnregistre !== undefined
      ) {
        lines.push(
          `- **Scrutins éligibles sans vote enregistré** : ${stats.scrutinsSansVoteEnregistre}`,
        );
      }
      lines.push("");

      lines.push(
        `## Derniers votes (page ${data.pagination.page}/${data.pagination.totalPages})`,
      );
      for (const vote of data.votes) {
        lines.push(
          `- **${vote.scrutin.title}** (${formatDate(vote.scrutin.votingDate)})`,
        );
        lines.push(
          `  Vote : ${formatPosition(vote.position)} — Résultat : ${formatResult(vote.scrutin.result)}`,
        );
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          politician: {
            slug: data.politician.slug,
            fullName: data.politician.fullName,
          },
          stats: data.stats,
          votes: data.votes.map((vote) => ({
            position: knownEnumCode(vote.position, VOTE_POSITIONS),
            scrutin: {
              title: vote.scrutin.title,
              votingDate: vote.scrutin.votingDate,
              result: knownEnumCode(vote.scrutin.result, VOTE_RESULTS),
              votesFor: vote.scrutin.votesFor,
              votesAgainst: vote.scrutin.votesAgainst,
              votesAbstain: vote.scrutin.votesAbstain,
              sourceUrl: vote.scrutin.sourceUrl,
            },
          })),
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
        },
      };
    },
  );

  server.registerTool(
    "get_vote_stats",
    {
      description:
        "Obtenir les statistiques de vote par parti : cohésion, scrutins divisifs et distribution globale. Les taux de participation non publiables restent explicitement indisponibles.",
      inputSchema: {
        chamber: z
          .enum(["AN", "SENAT"])
          .optional()
          .describe("Filtrer par chambre : AN (Assemblée) ou SENAT"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Calcul des statistiques de vote...",
        "openai/toolInvocation/invoked": "Statistiques calculées",
      },
    },
    async ({ chamber }) => {
      const data = await fetchAPI<VoteStatsResponse>("/api/votes/stats", {
        chamber,
      });

      const lines: string[] = [];
      const chamberLabel =
        chamber === "AN"
          ? "Assemblée nationale"
          : chamber === "SENAT"
            ? "Sénat"
            : "Toutes chambres";
      lines.push(`# Statistiques de vote — ${chamberLabel}`);
      lines.push("");

      lines.push("## Vue globale");
      lines.push(`- **Total scrutins** : ${data.global.totalScrutins}`);
      lines.push(
        `- **Total votes exprimés recensés** : ${data.global.totalVotes}`,
      );
      lines.push(`- Pour : ${data.global.totalVotesFor}`);
      lines.push(`- Contre : ${data.global.totalVotesAgainst}`);
      lines.push(`- Abstention : ${data.global.totalVotesAbstain}`);
      lines.push(
        `- **Adoptés** : ${data.global.adoptes} — **Rejetés** : ${data.global.rejetes}`,
      );
      lines.push(`- ${participationLine(data.global)}`);
      lines.push("");

      lines.push("## Cohésion par parti");
      const sorted = [...data.parties].sort(
        (a, b) => b.cohesionRate - a.cohesionRate,
      );
      for (const party of sorted) {
        lines.push(
          `- **${party.partyShortName}** (${party.partyName}) : ${party.cohesionRate}% de cohésion (${party.totalVotes} votes enregistrés)`,
        );
      }
      lines.push("");

      if (data.divisiveScrutins.length > 0) {
        lines.push("## Scrutins les plus divisifs");
        for (const scrutin of data.divisiveScrutins.slice(0, 10)) {
          lines.push(
            `- **${scrutin.title}** (${formatDate(scrutin.votingDate)})`,
          );
          lines.push(
            `  Pour: ${scrutin.votesFor}, Contre: ${scrutin.votesAgainst}, Abstention: ${scrutin.votesAbstain} — Score de division : ${scrutin.divisionScore}%`,
          );
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          global: data.global,
          parties: data.parties.map((party) => ({
            shortName: party.partyShortName,
            name: party.partyName,
            cohesionRate: party.cohesionRate,
            participationRate: party.participationRate,
            participationStatus: party.participationStatus ?? null,
            totalVotes: party.totalVotes,
          })),
          divisiveScrutins: data.divisiveScrutins
            .slice(0, 10)
            .map((scrutin) => ({
              title: scrutin.title,
              votingDate: scrutin.votingDate,
              votesFor: scrutin.votesFor,
              votesAgainst: scrutin.votesAgainst,
              votesAbstain: scrutin.votesAbstain,
              divisionScore: scrutin.divisionScore,
            })),
        },
      };
    },
  );
}
