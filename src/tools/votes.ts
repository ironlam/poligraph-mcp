import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI } from "../api.js";

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
  shortName: string;
  color: string;
  memberCount: number;
  cohesion: number;
  unanimousVotes: number;
  totalVotes: number;
}

interface DivisiveScrutin {
  id: string;
  title: string;
  votingDate: string;
  legislature: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  result: string;
  divisivityScore: number;
}

interface VoteStatsResponse {
  parties: PartyStats[];
  divisiveScrutins: DivisiveScrutin[];
  global: {
    totalVotes: number;
    totalVotesFor: number;
    totalVotesAgainst: number;
    totalVotesAbstain: number;
    averageCohesion: number;
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
    absent: number;
    participationRate: number;
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

function formatResult(result: string): string {
  return result === "ADOPTED" ? "Adopté" : "Rejeté";
}

function formatPosition(position: string): string {
  const labels: Record<string, string> = {
    POUR: "Pour",
    CONTRE: "Contre",
    ABSTENTION: "Abstention",
    NON_VOTANT: "Non votant",
    ABSENT: "Absent",
  };
  return labels[position] || position;
}

export function registerVoteTools(server: McpServer): void {
  server.tool(
    "list_votes",
    "Lister les scrutins parlementaires (Assemblée nationale et Sénat) avec filtres.",
    {
      search: z.string().optional().describe("Recherche dans le titre du scrutin"),
      result: z.enum(["ADOPTED", "REJECTED"]).optional().describe("Filtrer par résultat : ADOPTED ou REJECTED"),
      legislature: z.number().int().optional().describe("Filtrer par législature (ex: 16, 17)"),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
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
      lines.push(`**${data.pagination.total} scrutins** (page ${data.pagination.page}/${data.pagination.totalPages})`);
      lines.push("");

      for (const s of data.data) {
        const resultLabel = formatResult(s.result);
        lines.push(`- **${s.title}** (${s.votingDate})`);
        lines.push(`  ${resultLabel} — Pour: ${s.votesFor}, Contre: ${s.votesAgainst}, Abstention: ${s.votesAbstain}`);
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_politician_votes",
    "Obtenir les votes d'un politicien spécifique avec ses statistiques de participation.",
    {
      slug: z.string().describe("Identifiant du politicien (ex: 'jean-luc-melenchon')"),
      page: z.number().int().min(1).default(1).describe("Numéro de page"),
      limit: z.number().int().min(1).max(100).default(20).describe("Résultats par page (max 100)"),
    },
    async ({ slug, page, limit }) => {
      const data = await fetchAPI<PoliticianVotesResponse>(
        `/api/politiques/${encodeURIComponent(slug)}/votes`,
        { page, limit },
      );

      const lines: string[] = [];
      const party = data.politician.party ? ` (${data.politician.party.name})` : "";
      lines.push(`# Votes — ${data.politician.fullName}${party}`);
      lines.push("");

      const s = data.stats;
      lines.push("## Statistiques");
      lines.push(`- **Total** : ${s.total} votes`);
      lines.push(`- **Pour** : ${s.pour} (${s.total ? Math.round((s.pour / s.total) * 100) : 0}%)`);
      lines.push(`- **Contre** : ${s.contre} (${s.total ? Math.round((s.contre / s.total) * 100) : 0}%)`);
      lines.push(`- **Abstention** : ${s.abstention}`);
      lines.push(`- **Absent** : ${s.absent}`);
      lines.push(`- **Taux de participation** : ${s.participationRate}%`);
      lines.push("");

      lines.push(`## Derniers votes (page ${data.pagination.page}/${data.pagination.totalPages})`);
      for (const v of data.votes) {
        const resultLabel = formatResult(v.scrutin.result);
        lines.push(`- **${v.scrutin.title}** (${v.scrutin.votingDate})`);
        lines.push(`  Vote : ${formatPosition(v.position)} — Résultat : ${resultLabel}`);
      }

      if (data.pagination.page < data.pagination.totalPages) {
        lines.push("");
        lines.push(`_Page suivante : page=${data.pagination.page + 1}_`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );

  server.tool(
    "get_vote_stats",
    "Obtenir les statistiques de vote par parti : cohésion, scrutins divisifs, distribution globale.",
    {
      chamber: z.enum(["AN", "SENAT"]).optional().describe("Filtrer par chambre : AN (Assemblée) ou SENAT"),
    },
    async ({ chamber }) => {
      const data = await fetchAPI<VoteStatsResponse>("/api/votes/stats", {
        chamber,
      });

      const lines: string[] = [];
      const chamberLabel = chamber === "AN" ? "Assemblée nationale" : chamber === "SENAT" ? "Sénat" : "Toutes chambres";
      lines.push(`# Statistiques de vote — ${chamberLabel}`);
      lines.push("");

      lines.push("## Vue globale");
      lines.push(`- **Total des votes** : ${data.global.totalVotes}`);
      lines.push(`- Pour : ${data.global.totalVotesFor}`);
      lines.push(`- Contre : ${data.global.totalVotesAgainst}`);
      lines.push(`- Abstention : ${data.global.totalVotesAbstain}`);
      lines.push(`- **Cohésion moyenne** : ${(data.global.averageCohesion * 100).toFixed(1)}%`);
      lines.push("");

      lines.push("## Cohésion par parti");
      const sorted = [...data.parties].sort((a, b) => b.cohesion - a.cohesion);
      for (const p of sorted) {
        lines.push(`- **${p.shortName}** : ${(p.cohesion * 100).toFixed(1)}% de cohésion (${p.memberCount} membres, ${p.totalVotes} votes)`);
      }
      lines.push("");

      if (data.divisiveScrutins.length > 0) {
        lines.push("## Scrutins les plus divisifs");
        for (const s of data.divisiveScrutins.slice(0, 10)) {
          const resultLabel = formatResult(s.result);
          lines.push(`- **${s.title}** (${s.votingDate})`);
          lines.push(`  ${resultLabel} — Score de divisivité : ${(s.divisivityScore * 100).toFixed(1)}%`);
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  );
}
