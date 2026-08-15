export interface AffairSemantics {
  involvementLabel: string;
  statusLabel: string;
  statusDescription: string;
  categoryLabel: string;
  statusAppliesToPolitician: boolean;
  needsPresumption: boolean;
  certaintyLevel: string | null;
  certaintyLabel: string | null;
  judicialMaturity: string;
  judicialMaturityLabel: string;
}

export interface ParticipationPublication {
  participationRate: number | null;
  participationStatus?: string;
}

export type FieldPublicationStatus =
  | "AVAILABLE"
  | "UNVERIFIED"
  | (string & {});

export const PRESUMPTION_NOTICE =
  "**Prudence** : la procédure est en cours ou la décision n'est pas définitive. La présomption d'innocence s'applique.";

export const CONTRACT_SEMANTICS_UNAVAILABLE =
  "Qualification éditoriale indisponible dans la version actuelle du contrat public Poligraph.";

export const UNVERIFIED_DATE_NOTICE =
  "Date de prise de fonction non affichée : sa provenance n'est pas encore suffisamment vérifiée.";

export function quoteData(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

export function affairSemanticsLines(
  semantics: AffairSemantics | undefined,
): string[] {
  if (!semantics) {
    return [`**Rôle et statut** : ${CONTRACT_SEMANTICS_UNAVAILABLE}`];
  }

  const lines = [`**Rôle de la personne** : ${semantics.involvementLabel}`];

  if (semantics.statusAppliesToPolitician) {
    lines.push(`**Statut de la procédure** : ${semantics.statusLabel}`);
  } else {
    lines.push(
      `**Statut de l'affaire** : ${semantics.statusLabel} _(ce statut ne qualifie pas la personne suivie)_`,
    );
  }

  lines.push(`**Faits qualifiés** : ${semantics.categoryLabel}`);
  lines.push(`_${semantics.statusDescription}_`);

  return lines;
}

export function participationLine(
  value: ParticipationPublication,
): string {
  if (
    value.participationStatus === "AVAILABLE" &&
    value.participationRate !== null &&
    Number.isFinite(value.participationRate)
  ) {
    return `**Taux de participation** : ${value.participationRate}%`;
  }

  return "**Taux de participation** : non publié avec les données actuellement disponibles";
}

export function canPublishStartDate(status: FieldPublicationStatus | undefined): boolean {
  // Old API responses do not carry a publication status. Absence is therefore
  // unknown, never equivalent to AVAILABLE.
  return status === "AVAILABLE";
}
