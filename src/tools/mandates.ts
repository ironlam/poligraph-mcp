import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError, fetchAPI, formatDate } from "../api.js";
import {
  canPublishStartDate,
  type FieldPublicationStatus,
  knownEnumCode,
  START_DATE_PUBLICATION_STATUSES,
  UNVERIFIED_DATE_NOTICE,
} from "../editorial.js";

interface MandateItem {
  id: string;
  type: string;
  title: string;
  institution: string | null;
  role: string | null;
  constituency: string | null;
  departmentCode: string | null;
  startDate: string;
  startDatePublicationStatus?: FieldPublicationStatus;
  endDate: string | null;
  isCurrent: boolean;
  politician: {
    id: string;
    slug: string;
    fullName: string;
    photoUrl: string | null;
  };
}

interface MandateListResponse {
  data: MandateItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function registerMandateTools(server: McpServer): void {
  server.registerTool(
    "list_mandates",
    {
      description:
        "Lister les mandats politiques publics. Une date de début n'est présentée comme ancienneté que si le contrat public la marque explicitement AVAILABLE.",
      inputSchema: {
        type: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Code de type de mandat accepté par l'API publique"),
        isCurrent: z
          .boolean()
          .optional()
          .describe("true = mandats en cours, false = mandats terminés"),
        institution: z
          .string()
          .max(200)
          .optional()
          .describe("Recherche sur l'institution (ex: 'Assemblée', 'Sénat')"),
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
        "openai/toolInvocation/invoking": "Recherche de mandats...",
        "openai/toolInvocation/invoked": "Mandats trouvés",
      },
    },
    async ({ type, isCurrent, institution, page, limit }) => {
      const data = await fetchAPI<MandateListResponse>("/api/mandats", {
        type,
        isCurrent: isCurrent !== undefined ? isCurrent : undefined,
        institution,
        page,
        limit,
      });

      // A 2xx response has already been received. Invalid client values belong
      // to the public API's 4xx validation; a mismatched successful payload is
      // an upstream contract violation and intentionally maps to 502.
      if (type && data.data.some((mandate) => mandate.type !== type)) {
        throw new ApiError(
          502,
          "Le contrat public Poligraph n'a pas appliqué le filtre de mandat demandé",
        );
      }

      const lines: string[] = [];
      lines.push(
        `**${data.pagination.total} mandats** (page ${data.pagination.page}/${data.pagination.totalPages})`,
      );
      lines.push("");

      for (const mandate of data.data) {
        const constituency = mandate.constituency
          ? ` — ${mandate.constituency}`
          : "";
        const institutionLabel = mandate.institution
          ? ` — ${mandate.institution}`
          : "";

        lines.push(
          `- **${mandate.politician.fullName}** : ${mandate.title}${institutionLabel}${constituency}`,
        );

        if (mandate.isCurrent) {
          if (canPublishStartDate(mandate.startDatePublicationStatus)) {
            lines.push(`  En cours — depuis ${formatDate(mandate.startDate)}`);
          } else {
            lines.push(`  En cours — ${UNVERIFIED_DATE_NOTICE}`);
          }
        } else {
          const end = mandate.endDate
            ? `Terminé le ${formatDate(mandate.endDate)}`
            : "Mandat terminé — date de fin non renseignée";
          if (canPublishStartDate(mandate.startDatePublicationStatus)) {
            lines.push(
              mandate.endDate
                ? `  ${formatDate(mandate.startDate)} → ${formatDate(mandate.endDate)}`
                : `  Depuis ${formatDate(mandate.startDate)} — mandat indiqué comme terminé, date de fin non renseignée`,
            );
          } else {
            lines.push(`  ${end} — date de début non publiée`);
          }
        }

        lines.push(`  /politiques/${mandate.politician.slug}`);
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
          items: data.data.map((mandate) => {
            const publishStartDate = canPublishStartDate(
              mandate.startDatePublicationStatus,
            );
            return {
              type: mandate.type,
              title: mandate.title,
              institution: mandate.institution,
              constituency: mandate.constituency,
              startDate: publishStartDate ? mandate.startDate : null,
              startDatePublicationStatus: knownEnumCode(
                mandate.startDatePublicationStatus,
                START_DATE_PUBLICATION_STATUSES,
              ),
              endDate: mandate.endDate,
              isCurrent: mandate.isCurrent,
              politician: {
                slug: mandate.politician.slug,
                fullName: mandate.politician.fullName,
                url: `https://poligraph.fr/politiques/${mandate.politician.slug}`,
              },
            };
          }),
        },
      };
    },
  );
}
