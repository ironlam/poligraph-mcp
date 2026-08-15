import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchAPI, formatDate } from "../api.js";

interface ElectionListItem {
  id: string;
  slug: string;
  type: string;
  title: string;
  shortTitle: string | null;
  status: string;
  scope: string | null;
  suffrage: string | null;
  round1Date: string | null;
  round2Date: string | null;
  dateConfirmed: boolean;
  totalSeats: number | null;
  candidacyCount: number;
}

interface ElectionListResponse {
  data: ElectionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Candidacy {
  id: string;
  candidateName: string;
  partyLabel: string | null;
  constituencyName: string | null;
  isElected: boolean | null;
  round1Votes: number | null;
  round1Pct: number | null;
  round2Votes: number | null;
  round2Pct: number | null;
  politician: {
    id: string;
    slug: string;
    fullName: string;
    photoUrl: string | null;
  } | null;
  party: {
    id: string;
    slug: string;
    shortName: string;
    color: string;
  } | null;
}

interface Round {
  round: number;
  date: string | null;
  registeredVoters: number | null;
  actualVoters: number | null;
  participationRate: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
}

interface ElectionDetailResponse {
  id: string;
  slug: string;
  type: string;
  title: string;
  shortTitle: string | null;
  status: string;
  scope: string | null;
  suffrage: string | null;
  round1Date: string | null;
  round2Date: string | null;
  dateConfirmed: boolean;
  totalSeats: number | null;
  candidacies: Candidacy[];
  rounds: Round[];
}

function formatElectionType(type: string): string {
  const labels: Record<string, string> = {
    PRESIDENTIELLE: "Présidentielle",
    LEGISLATIVES: "Législatives",
    SENATORIALES: "Sénatoriales",
    MUNICIPALES: "Municipales",
    DEPARTEMENTALES: "Départementales",
    REGIONALES: "Régionales",
    EUROPEENNES: "Européennes",
    REFERENDUM: "Référendum",
  };
  return labels[type] ?? "Type d'élection non disponible";
}

function formatElectionStatus(status: string): string {
  const labels: Record<string, string> = {
    UPCOMING: "À venir",
    REGISTRATION: "Inscriptions ouvertes",
    CANDIDACIES: "Dépôt des candidatures",
    CAMPAIGN: "Campagne en cours",
    ROUND_1: "1er tour",
    BETWEEN_ROUNDS: "Entre-deux-tours",
    ROUND_2: "2nd tour",
    COMPLETED: "Terminée",
  };
  return labels[status] ?? "Statut non disponible";
}

export function candidacyLine(candidacy: Candidacy): string {
  const party = candidacy.party
    ? ` (${candidacy.party.shortName})`
    : candidacy.partyLabel
      ? ` (${candidacy.partyLabel})`
      : "";
  const results: string[] = [];
  if (candidacy.round1Pct !== null) results.push(`T1: ${candidacy.round1Pct}%`);
  if (candidacy.round2Pct !== null) results.push(`T2: ${candidacy.round2Pct}%`);
  const result = results.length > 0 ? ` — ${results.join(", ")}` : "";
  return `${candidacy.candidateName}${party}${result}`;
}

export function registerElectionTools(server: McpServer): void {
  server.registerTool(
    "list_elections",
    {
      description:
        "Lister les élections françaises avec filtres. Une donnée absente reste absente et n'est jamais assimilée à zéro ou à un résultat négatif.",
      inputSchema: {
        type: z
          .enum([
            "PRESIDENTIELLE",
            "LEGISLATIVES",
            "SENATORIALES",
            "MUNICIPALES",
            "DEPARTEMENTALES",
            "REGIONALES",
            "EUROPEENNES",
            "REFERENDUM",
          ])
          .optional()
          .describe("Filtrer par type d'élection"),
        status: z
          .enum([
            "UPCOMING",
            "REGISTRATION",
            "CANDIDACIES",
            "CAMPAIGN",
            "ROUND_1",
            "BETWEEN_ROUNDS",
            "ROUND_2",
            "COMPLETED",
          ])
          .optional()
          .describe("Filtrer par statut"),
        year: z.number().int().optional().describe("Filtrer par année (ex: 2027)"),
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
        "openai/toolInvocation/invoking": "Recherche d'élections...",
        "openai/toolInvocation/invoked": "Élections trouvées",
      },
    },
    async ({ type, status, year, page, limit }) => {
      const data = await fetchAPI<ElectionListResponse>("/api/elections", {
        type,
        status,
        year,
        page,
        limit,
      });

      const lines: string[] = [];
      lines.push(
        `**${data.pagination.total} élection(s)** (page ${data.pagination.page}/${data.pagination.totalPages})`,
      );
      lines.push("");

      for (const election of data.data) {
        const date = election.round1Date
          ? formatDate(election.round1Date)
          : "Date non renseignée";
        const confirmed =
          election.round1Date && !election.dateConfirmed ? " (date non confirmée)" : "";
        const seats =
          election.totalSeats !== null ? ` — ${election.totalSeats} sièges` : "";
        const candidacies =
          election.candidacyCount > 0
            ? ` — ${election.candidacyCount} candidature(s)`
            : "";

        lines.push(
          `- **${election.title}** (${formatElectionType(election.type)})`,
        );
        lines.push(
          `  ${formatElectionStatus(election.status)} — ${date}${confirmed}${seats}${candidacies}`,
        );
        lines.push(`  /elections/${election.slug}`);
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
          items: data.data.map((election) => ({
            slug: election.slug,
            type: election.type,
            title: election.title,
            status: election.status,
            round1Date: election.round1Date,
            round2Date: election.round2Date,
            dateConfirmed: election.dateConfirmed,
            totalSeats: election.totalSeats,
            candidacyCount: election.candidacyCount,
            url: `https://poligraph.fr/elections/${election.slug}`,
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_election",
    {
      description:
        "Obtenir le détail d'une élection : candidatures, résultats par tour et participation. null reste inconnu et 0 reste une valeur réelle.",
      inputSchema: {
        slug: z
          .string()
          .describe(
            "Identifiant de l'élection (ex: 'municipales-2026', 'presidentielle-2027')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/toolInvocation/invoking": "Chargement de l'élection...",
        "openai/toolInvocation/invoked": "Élection chargée",
      },
    },
    async ({ slug }) => {
      const data = await fetchAPI<ElectionDetailResponse>(
        `/api/elections/${encodeURIComponent(slug)}`,
      );

      const lines: string[] = [];
      lines.push(`# ${data.title}`);
      lines.push(`**Type** : ${formatElectionType(data.type)}`);
      lines.push(`**Statut** : ${formatElectionStatus(data.status)}`);

      if (data.round1Date) {
        lines.push(
          `**1er tour** : ${formatDate(data.round1Date)}${!data.dateConfirmed ? " (date non confirmée)" : ""}`,
        );
      }
      if (data.round2Date) {
        lines.push(`**2nd tour** : ${formatDate(data.round2Date)}`);
      }
      if (data.totalSeats !== null) {
        lines.push(`**Sièges** : ${data.totalSeats}`);
      }
      if (data.scope) lines.push(`**Portée** : ${data.scope}`);
      if (data.suffrage) lines.push(`**Suffrage** : ${data.suffrage}`);

      if (data.rounds.length > 0) {
        lines.push("");
        lines.push("## Tours de scrutin");
        for (const round of data.rounds) {
          lines.push(
            `### Tour ${round.round}${round.date ? ` — ${formatDate(round.date)}` : ""}`,
          );
          if (round.registeredVoters !== null) {
            lines.push(
              `- Inscrits : ${round.registeredVoters.toLocaleString("fr-FR")}`,
            );
          }
          if (round.actualVoters !== null) {
            lines.push(
              `- Votants : ${round.actualVoters.toLocaleString("fr-FR")}`,
            );
          }
          if (round.participationRate !== null) {
            lines.push(`- Participation : ${round.participationRate}%`);
          }
          if (round.blankVotes !== null) {
            lines.push(
              `- Bulletins blancs : ${round.blankVotes.toLocaleString("fr-FR")}`,
            );
          }
          if (round.nullVotes !== null) {
            lines.push(
              `- Bulletins nuls : ${round.nullVotes.toLocaleString("fr-FR")}`,
            );
          }
        }
      }

      if (data.candidacies.length > 0) {
        lines.push("");
        lines.push(`## Candidatures (${data.candidacies.length})`);

        const elected = data.candidacies.filter(
          (candidacy) => candidacy.isElected === true,
        );
        const notElected = data.candidacies.filter(
          (candidacy) => candidacy.isElected === false,
        );
        const unknown = data.candidacies.filter(
          (candidacy) => candidacy.isElected === null,
        );

        if (elected.length > 0) {
          lines.push("### Élu(e)s");
          for (const candidacy of elected) {
            lines.push(`- **${candidacyLine(candidacy)}**`);
          }
        }

        if (notElected.length > 0) {
          lines.push("### Autres candidatures avec résultat");
          for (const candidacy of notElected.slice(0, 20)) {
            lines.push(`- ${candidacyLine(candidacy)}`);
          }
          if (notElected.length > 20) {
            lines.push(`_... et ${notElected.length - 20} autres_`);
          }
        }

        if (unknown.length > 0) {
          lines.push("### Résultat d'élection non renseigné");
          for (const candidacy of unknown.slice(0, 20)) {
            lines.push(`- ${candidacyLine(candidacy)}`);
          }
          if (unknown.length > 20) {
            lines.push(`_... et ${unknown.length - 20} autres_`);
          }
        }
      }

      lines.push("");
      lines.push(`https://poligraph.fr/elections/${data.slug}`);

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          slug: data.slug,
          type: data.type,
          title: data.title,
          status: data.status,
          round1Date: data.round1Date,
          round2Date: data.round2Date,
          dateConfirmed: data.dateConfirmed,
          totalSeats: data.totalSeats,
          rounds: data.rounds.map((round) => ({
            round: round.round,
            date: round.date,
            registeredVoters: round.registeredVoters,
            actualVoters: round.actualVoters,
            participationRate: round.participationRate,
            blankVotes: round.blankVotes,
            nullVotes: round.nullVotes,
          })),
          candidacies: data.candidacies.map((candidacy) => ({
            candidateName: candidacy.candidateName,
            party: candidacy.party
              ? candidacy.party.shortName
              : candidacy.partyLabel,
            isElected: candidacy.isElected,
            round1Pct: candidacy.round1Pct,
            round2Pct: candidacy.round2Pct,
            politicianSlug: candidacy.politician?.slug ?? null,
          })),
          url: `https://poligraph.fr/elections/${data.slug}`,
        },
      };
    },
  );
}
